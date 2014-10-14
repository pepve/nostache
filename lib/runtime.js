module.exports = {
	render: render,
	SectionFunction: SectionFunction,
	LazyValue: LazyValue,
	injectMockFs: injectMockFs };

var fs = require('fs'),
	Parser = require('./Parser');

var cache = {};

function SectionFunction (getter) {
	this.getter = getter;
}

function LazyValue (getter) {
	this.getter = getter;
}

function injectMockFs (mockFs) {
	fs = mockFs;
}

function render (directory, filename, view, cb) {
	var context = { object: view };
	var state = { directory: directory + '/', buffers: [], depth: 0 };

	runTemplate(state, context, filename, function (err) {
		if (err) {
			return cb(err);
		}

		cb(null, Buffer.concat(state.buffers));
	});
}

function runTemplate (state, context, filename, cb) {
	// Actually, path.join could (should) be used here, but it took 5% of the
	// time on a benchmark template, plain concatenation is much faster.
	var absFilename = state.directory + filename;

	fs.stat(absFilename, function (err, stats) {
		if (err) {
			return cb(err);
		}

		if (cache.hasOwnProperty(absFilename) && cache[absFilename].mtime >= stats.mtime) {
			runList(state, absFilename, context, cache[absFilename].ast.list, cb);

		} else {
			fs.readFile(absFilename, { encoding: 'utf8' }, function (err, text) {
				if (err) {
					return cb(err);
				}

				var ast;
				try {
					ast = (new Parser(text)).parse();
				} catch (ex) {
					return cb('Parse error in "' + absFilename + '": ' + ex.message);
				}

				prepare(ast);

				cache[absFilename] = { mtime: stats.mtime, ast: ast };

				runList(state, absFilename, context, ast.list, cb);
			});
		}
	});
}

function prepare (ast) {
	if (ast.type === 'text') {
		ast.buffer = new Buffer(ast.content);
	}

	if (ast.list) {
		ast.list.forEach(prepare);
	}
}

function runList (state, absFilename, context, list, cb) {
	var i = 0;

	(function listLoop (err) {
		if (err) {
			return cb(err);
		}

		if (++state.depth % 1000 === 0) {
			return process.nextTick(listLoop);
		}

		if (i >= list.length) {
			return cb(null);
		}

		var item = list[i++];

		switch (item.type) {
			case 'text':
				state.buffers.push(item.buffer);
				listLoop();
				break;

			case 'variable':
				runVariable(state, context, item.tag.key, false, listLoop);
				break;

			case 'unescaped':
				runVariable(state, context, item.tag.key, true, listLoop);
				break;

			case 'section':
				runSection(state, absFilename, context, item, listLoop);
				break;

			case 'inverted':
				runInverted(state, absFilename, context, item, listLoop);
				break;

			case 'partial':
				runTemplate(state, context, item.tag.key, listLoop);
				break;

			default:
				cb('Illegal item type "' + item.type + '"');
		}
	}());
}

function runVariable (state, context, key, unescaped, cb) {
	resolve(context, key, function (err, value) {
		if (err) {
			return cb(err);
		}

		echo(state.buffers, value, unescaped);

		cb();
	});
}

function runSection (state, absFilename, context, item, cb) {
	resolve(context, item.openTag.key, function (err, value) {
		if (err) {
			return cb(err);
		}

		if (value instanceof SectionFunction) {
			if (item.list.length !== 1 || item.list[0].type !== 'text') {
				cb('Runtime error in "' + absFilename + '": ' + item.openTag.src +
					' is a section function (it can only have textual content) on line ' +
					item.openTag.line + ', col ' + item.openTag.col);

			} else {
				var res;
				try {
					res = value.getter(item.list[0].content);
				} catch (ex) {
					return cb(ex);
				}

				echo(state.buffers, res, true);

				cb();
			}
		} else if (Array.isArray(value)) {
			var i = 0;

			(function sectionArrayLoop (err) {
				if (err) {
					return cb(err);
				}

				if (i >= value.length) {
					return cb();
				}

				materialize(value[i++], function (err, curValue) {
					if (err) {
						return cb(err);
					}

					var newContext = typeof curValue === 'object' ?
										{ object: curValue, parent: context } :
										context;

					runList(state, absFilename, newContext, item.list, sectionArrayLoop);
				});
			}());
		} else if (value) {
			var newContext = typeof value === 'object' ?
								{ object: value, parent: context } :
								context;

			runList(state, absFilename, newContext, item.list, cb);
		} else {
			cb();
		}
	});
}

function runInverted (state, absFilename, context, item, cb) {
	resolve(context, item.openTag.key, function (err, value) {
		if (err) {
			return cb(err);
		}

		if (!value || (Array.isArray(value) && value.length === 0)) {
			runList(state, absFilename, context, item.list, cb);
		} else {
			cb();
		}
	});
}

var ENTITY_QUOT = new Buffer('&quot;');
var ENTITY_AMP = new Buffer('&amp;');
var ENTITY_APOS = new Buffer('&apos;');
var ENTITY_LT = new Buffer('&lt;');
var ENTITY_GT = new Buffer('&gt;');

function echo (buffers, value, unescaped) {
	if (value !== undefined && value !== null) {
		var out = new Buffer(value.toString());

		if (unescaped) {
			buffers.push(out);

		} else {
			var start = 0;
			var ent;

			for (var i = 0; i < out.length; i++) {
				switch (out[i]) {
					case 34: ent = ENTITY_QUOT; break;
					case 38: ent = ENTITY_AMP; break;
					case 39: ent = ENTITY_APOS; break;
					case 60: ent = ENTITY_LT; break;
					case 62: ent = ENTITY_GT; break;
				}

				if (ent) {
					buffers.push(out.slice(start, i));
					buffers.push(ent);
					start = i + 1;
					ent = undefined;
				}
			}

			if (start < i) {
				if (start === 0) {
					buffers.push(out);
				} else {
					buffers.push(out.slice(start, i));
				}
			}
		}
	}
}

function resolve (context, key, cb) {
	var first = key[0];

	// Walk up the context until we find the first key part in it
	while (!context.object.hasOwnProperty(first) && context.parent) {
		context = context.parent;
	}

	var object = context.object[first];

	if (key.length === 1 && !(object instanceof LazyValue)) {
		// Logically redundant but comes with great performance improvements
		return cb(null, object);
	}

	(function resolveLoop (i, object) {
		materialize(object, function (err, object) {
			if (err) {
				return cb(err);
			}

			var nth = key[i];

			if (nth === undefined) {
				// There are no more key parts to resolve, the current object is the result
				cb(null, object);

			} else if (object === null || object === undefined || !object.hasOwnProperty(nth)) {
				// No current object or it doesn't have a property with the current key part
				cb();

			} else {
				// There is a current object and it has a property with the current key part
				resolveLoop(i + 1, object[nth]);
			}
		});
	}(1, object));
}

function materialize (object, cb) {
	if (object instanceof LazyValue) {
		process.nextTick(object.getter.bind(null, function (err, res) {
			if (err) {
				cb(err);
			} else {
				materialize(res, cb);
			}
		}));
	} else {
		cb(null, object);
	}
}
