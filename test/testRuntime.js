var domain = require('domain'),
	runtime = require('../lib/runtime');

var basicNum = 0;
function basicTest (template, view, expected) {
	return function (test) {
		runtime.injectMockFs({
			readFile: function (filename, options, cb) { cb(null, template); },
			stat: function (filename, cb) { cb(null, { mtime: new Date(0) }); } });

		test.expect(2);

		runtime.render('/dir', 'basic' + basicNum++, view, function (err, buffer) {
			test.equal(err, null);
			test.equal(buffer.toString(), expected);
			test.done();
		});
	};
}

var errorNum = 0;
function errorTest (template, view, expected) {
	return function (test) {
		runtime.injectMockFs({
			readFile: function (filename, options, cb) { cb(null, template); },
			stat: function (filename, cb) { cb(null, { mtime: new Date(0) }); } });

		test.expect(2);

		runtime.render('/dir', 'error' + errorNum++, view, function (err, buffer) {
			test.deepEqual(err, expected);
			test.equal(buffer, null);
			test.done();
		});
	};
}

exports.specialFeatures = basicTest(
	'A regular {{value}}, and {{#__}}a translation{{/__}}, and a {{thing}} from the database.',
	{ value: 42,
	  __: new runtime.SectionFunction(function () { return 'een vertaling'; }),
	  thing: new runtime.LazyValue(function (cb) { cb(null, 'record'); }) },
	'A regular 42, and een vertaling, and a record from the database.');

exports.empty = basicTest(
	'',
	{},
	'');

exports.simplest = basicTest(
	'foo',
	{},
	'foo');

exports.parseError = errorTest(
	'{{',
	{},
	'Parse error in "/dir/error0": Expected key part on line 1, col 3');

exports.caching1 = function (test) {
	test.expect(3);

	runtime.injectMockFs({
		readFile: function (filename, options, cb) { cb(null, 'original'); },
		stat: function (filename, cb) { cb(null, { mtime: new Date(0) }); } });

	runtime.render('/dir', 'caching', {}, function (err, buffer) {
		test.equal(buffer.toString(), 'original');

		runtime.injectMockFs({
			readFile: function (filename, options, cb) { cb('not called'); },
			stat: function (filename, cb) { cb(null, { mtime: new Date(0) }); } });

		runtime.render('/dir', 'caching', {}, function (err, buffer) {
			test.equal(buffer.toString(), 'original');

			runtime.injectMockFs({
				readFile: function (filename, options, cb) { cb(null, 'new version'); },
				stat: function (filename, cb) { cb(null, { mtime: new Date(1) }); } });

			runtime.render('/dir', 'caching', {}, function (err, buffer) {
				test.equal(buffer.toString(), 'new version');
				test.done();
			});
		});
	});
};

exports.caching2 = function (test) {
	test.expect(2);

	var partial = 'foo bar';
	var mtime = 0;

	runtime.injectMockFs({
		readFile: function (filename, options, cb) {
			cb(null, filename === '/caching2/index' ? '{{#arr}}{{>partial}}\n{{/arr}}' : partial);
		},
		stat: function (filename, cb) { cb(null, { mtime: new Date(mtime) }); } });

	var view = { arr: [
		'a',
		new runtime.LazyValue(function (cb) {
			partial = 'baz';
			mtime = 1;

			cb(null, 'b');
		}) ] };

	runtime.render('/caching2', 'index', view, function (err, buffer) {
		test.equal(buffer.toString(), 'foo bar\nfoo bar\n');

		runtime.render('/caching2', 'index', view, function (err, buffer) {
			test.equal(buffer.toString(), 'baz\nbaz\n');
			test.done();
		});
	});
};

exports.statError = function (test) {
	runtime.injectMockFs({
		readFile: function (filename, options, cb) { cb('read error'); },
		stat: function (filename, cb) { cb('stat error'); } });

	test.expect(2);

	runtime.render('/dir', 'stat-error', {}, function (err, buffer) {
		test.equal(err, 'stat error');
		test.equal(buffer, null);
		test.done();
	});
};

exports.readError = function (test) {
	runtime.injectMockFs({
		readFile: function (filename, options, cb) { cb('read error'); },
		stat: function (filename, cb) { cb(null, { mtime: new Date(0) }); } });

	test.expect(2);

	runtime.render('/dir', 'read-error', {}, function (err, buffer) {
		test.equal(err, 'read error');
		test.equal(buffer, null);
		test.done();
	});
};

////////////////////////////////////////////////////////////////////////////////
// Variables ///////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////

exports.variableString = basicTest(
	'{{foo}}',
	{ foo: 'bar' },
	'bar');

exports.variableInteger = basicTest(
	'{{foo}}',
	{ foo: 1 },
	'1');

exports.variableDecimal = basicTest(
	'{{foo}}',
	{ foo: 1.5 },
	'1.5');

exports.variableTrue = basicTest(
	'{{foo}}',
	{ foo: true },
	'true');

exports.variableFalse = basicTest(
	'{{foo}}',
	{ foo: false },
	'false');

exports.variableUndefined = basicTest(
	'{{foo}}',
	{},
	'');

exports.variableNull = basicTest(
	'{{foo}}',
	{ foo: null },
	'');

exports.variableEmptyObject = basicTest(
	'{{foo}}',
	{ foo: {} },
	'[object Object]');

exports.variableSomeObject = basicTest(
	'{{foo}}',
	{ foo: { some: 'bar' } },
	'[object Object]');

exports.variableEmptyArray = basicTest(
	'{{foo}}',
	{ foo: [] },
	'');

exports.variableArray = basicTest(
	'{{foo}}',
	{ foo: [ 3, 1, 4, 5 ] },
	'3,1,4,5');

////////////////////////////////////////////////////////////////////////////////
// Escaping ////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////

exports.simpleEscaped = basicTest(
	'{{foo}}',
	{ foo: 'a & b' },
	'a &amp; b');

exports.escapedAtEnd = basicTest(
	'{{foo}}',
	{ foo: 'a &' },
	'a &amp;');

exports.escapedAtStart = basicTest(
	'{{foo}}',
	{ foo: '& b' },
	'&amp; b');

exports.allEscaped = basicTest(
	'{{foo}}',
	{ foo: '&"\'<>' },
	'&amp;&quot;&apos;&lt;&gt;');

exports.allUnescaped = basicTest(
	'{{{foo}}}',
	{ foo: '&"\'<>' },
	'&"\'<>');

////////////////////////////////////////////////////////////////////////////////
// Sections ////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////

exports.sectionUndefined = basicTest(
	'{{#foo}}bar{{/foo}}',
	{},
	'');

exports.sectionEmptyArray = basicTest(
	'{{#foo}}bar{{/foo}}',
	{ foo: [] },
	'');

exports.sectionFalse = basicTest(
	'{{#foo}}bar{{/foo}}',
	{ foo: false },
	'');

exports.sectionTrue = basicTest(
	'{{#foo}}bar{{/foo}}',
	{ foo: true },
	'bar');

exports.sectionObject = basicTest(
	'{{#foo}}bar{{/foo}}',
	{ foo: {} },
	'bar');

exports.sectionArray1 = basicTest(
	'{{#foo}}bar{{/foo}}',
	{ foo: [ 3 ] },
	'bar');

exports.sectionArray2 = basicTest(
	'{{#foo}}bar{{/foo}}',
	{ foo: [ 3, 1 ] },
	'barbar');

////////////////////////////////////////////////////////////////////////////////
// Section context /////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////

exports.sectionObjectContext = basicTest(
	'{{#foo}}{{bar}}{{/foo}}',
	{ foo: { bar: 'baz' } },
	'baz');

exports.sectionArrayContext = basicTest(
	'{{#foo}}{{bar}}{{/foo}}',
	{ foo: [
		{ bar: 'baz' },
		{ bar: 'bal' } ] },
	'bazbal');

exports.sectionObjectContextNesting1 = basicTest(
	'{{#foo}}{{#bar}}{{#baz}}{{#bal}}{{hello}}{{/bal}}{{/baz}}{{/bar}}{{/foo}}',
	{ foo: { bar: { baz: { bal: { hello: 'world' } } } } },
	'world');

exports.sectionObjectContextNesting2 = basicTest(
	'{{#foo}}{{#bar}}{{#baz}}{{#bal}}{{hello}}{{/bal}}{{/baz}}{{/bar}}{{/foo}}',
	{ foo: { bar: { baz: { bal: { } } } },
	  hello: 'world' },
	'world');

exports.sectionObjectContextNesting3 = basicTest(
	'{{#foo}}{{#bar}}{{#baz}}{{#bal}}{{hello}}{{/bal}}{{/baz}}{{/bar}}{{/foo}}',
	{ foo: { bar: { baz: { bal: { } }, hello: null } },
	  hello: 'world' },
	'');

exports.sectionObjectContextNesting4 = basicTest(
	'{{#foo}}{{#bar}}{{#baz}}{{#bal}}{{hello}}{{/bal}}{{/baz}}{{/bar}}{{/foo}}',
	{ foo: { bar: { baz: { bal: { } }, hello: undefined } },
	  hello: 'world' },
	'');

////////////////////////////////////////////////////////////////////////////////
// Inverted sections ///////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////

exports.invertedTrue = basicTest(
	'{{^foo}}bar{{/foo}}',
	{ foo: true },
	'');

exports.invertedFalse = basicTest(
	'{{^foo}}bar{{/foo}}',
	{ foo: false },
	'bar');

exports.invertedEmptyArray = basicTest(
	'{{^foo}}bar{{/foo}}',
	{ foo: [] },
	'bar');

exports.invertedArray1 = basicTest(
	'{{^foo}}bar{{/foo}}',
	{ foo: [ 3 ] },
	'');

exports.invertedObject = basicTest(
	'{{^foo}}bar{{/foo}}',
	{ foo: {} },
	'');

//////////////////////////////////////////////////////////////////////////////////
//// Section functions ///////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////

exports.sectionFunction = function (test) {
	runtime.injectMockFs({
		readFile: function (filename, options, cb) { cb(null, '{{#foo}}heya{{/foo}}'); },
		stat: function (filename, cb) { cb(null, { mtime: new Date(0) }); } });

	test.expect(3);

	var view = { foo: new runtime.SectionFunction(function (text) {
		test.equal(text, 'heya');
		return 'world';
	}) };

	runtime.render('', '', view, function (err, buffer) {
		test.equal(err, null);
		test.equal(buffer.toString(), 'world');
		test.done();
	});
};

exports.sectionFunctionWithNestedVariable = errorTest(
	'{{#hello}}hi {{name}}{{/hello}}',
	{ hello: new runtime.SectionFunction(function () {}) },
	'Runtime error in "/dir/error1": ' +
		'{{#hello}} is a section function (it can only have textual content) on line 1, col 1');

exports.sectionFunctionAsVariable = basicTest(
	'{{foo}}',
	{ foo: new runtime.SectionFunction(function () {}) },
	'[object Object]');

exports.sectionFunctionAsInverted = basicTest(
	'{{^foo}}15{{/foo}}',
	{ foo: new runtime.SectionFunction(function () {}) },
	'');

exports.sectionFunctionNull = basicTest(
	'{{#foo}}Lorem ipsum{{/foo}}',
	{ foo: new runtime.SectionFunction(function () { return null; }) },
	'');

exports.sectionFunctionUndefined = basicTest(
	'{{#foo}}Lorem ipsum{{/foo}}',
	{ foo: new runtime.SectionFunction(function () {}) },
	'');

exports.sectionFunctionDoesntEscape = basicTest(
	'{{#yellow}}bar{{/yellow}}',
	{ yellow: new runtime.SectionFunction(function (text) { return text.fontcolor('yellow'); }) },
	'<font color="yellow">bar</font>');

exports.sectionFunctionThrows = errorTest(
	'{{#foo}}Lorem ipsum{{/foo}}',
	{ foo: new runtime.SectionFunction(function () { throw { badness: 'yes' }; }) },
	{ badness: 'yes' });

exports.SectionFunctionThrowsInArray = errorTest(
	'{{#array}}{{#foo}}Lorem ipsum{{/foo}}{{/array}}',
	{ array: [ { foo: new runtime.SectionFunction(function () { throw 'badness'; }) } ] },
	'badness');

//////////////////////////////////////////////////////////////////////////////////
//// Lazy values /////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////

exports.lazyString = basicTest(
	'{{foo}}',
	{ foo: new runtime.LazyValue(function (cb) { cb(null, 'bar'); }) },
	'bar');

exports.lazyLazyString = basicTest(
	'{{foo}}',
	{ foo: new runtime.LazyValue(function (cb) { cb(null,
		new runtime.LazyValue(function (cb) { cb(null, 'bar'); })); }) },
	'[object Object]');

exports.lazyUnescaped = basicTest(
	'{{{foo}}}',
	{ foo: new runtime.LazyValue(function (cb) { cb(null, '&"\'<>'); }) },
	'&"\'<>');

exports.lazyArrays1 = basicTest(
	'{{#foo}}bar{{/foo}}',
	{ foo: new runtime.LazyValue(function (cb) { cb(null, [
		new runtime.LazyValue(function (cb) { cb(null, 3); }),
		new runtime.LazyValue(function (cb) { cb(null, 1); }) ]); }) },
	'barbar');

exports.lazyArrays2 = basicTest(
	'{{#foo}}{{bar}}{{/foo}}',
	{ foo: [ new runtime.LazyValue(function (cb) { cb(null, { bar: 3 }); }) ] },
	'3');

exports.lazyObjectContext = basicTest(
	'{{#foo}}{{bar}}{{/foo}}',
	{ foo: new runtime.LazyValue(function (cb) { cb(null, { bar: 'baz' }); }) },
	'baz');

exports.lazyInverted = basicTest(
	'{{^foo}}bar{{/foo}}',
	{ foo: new runtime.LazyValue(function (cb) { cb(null, true); }) },
	'');

var pi = Math.PI;
exports.lazyIsNotRecomputed = basicTest(
	'{{pi}}, {{pi}}',
	{ pi: new runtime.LazyValue(function (cb) { cb(null, ++pi); }) },
	'4.141592653589793, 4.141592653589793');

exports.lazyErrbacksString = errorTest(
	'{{foo.bar}}',
	{ foo: new runtime.LazyValue(function (cb) { cb('badness'); }) },
	'badness');

exports.lazyErrbacksObject = errorTest(
	'{{foo.bar}}',
	{ foo: new runtime.LazyValue(function (cb) { cb({ badness: 'yes' }); }) },
	{ badness: 'yes' });

// In other words: exceptions from LazyValueS are your own problem
exports.lazyThrows = function (test) {
	var template = '{{foo}}';
	var view = { foo: new runtime.LazyValue(function () { throw 'badness'; }) };

	runtime.injectMockFs({
		readFile: function (filename, options, cb) { cb(null, template); },
		stat: function (filename, cb) { cb(null, { mtime: new Date(0) }); } });

	test.expect(1);

	var dom = domain.create();

	dom.on('error', function (err) {
		test.equal(err, 'badness');
		test.done();
	});

	dom.run(function () {
		runtime.render('/dir', 'asyncThrows', view, function () {
			test.ok(false);
			test.done();
		});
	});
};

////////////////////////////////////////////////////////////////////////////////
// Dotted variables ////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////

exports.dottedVariableNumber = basicTest(
	'{{foo.bar}}',
	{ foo: { bar: 3 } },
	'3');

exports.dottedVariableUndefined = basicTest(
	'{{foo.bar}}',
	{ foo: {} },
	'');

exports.dottedVariableNested = basicTest(
	'{{#heya}}{{foo.bar}}{{/heya}}',
	{ foo: { bar: 3 }, heya: {} },
	'3');

exports.dottedVariable1 = basicTest(
	'{{foo.bar.baz}}',
	{ foo: { bar: { baz: 3.1415 } } },
	'3.1415');

exports.dottedVariable2 = basicTest(
	'{{foo.bar.baz}}',
	{ foo: { bar: {} } },
	'');

exports.dottedVariable3 = basicTest(
	'{{foo.bar.baz}}',
	{ foo: { bar: null } },
	'');

exports.dottedVariable4 = basicTest(
	'{{foo.bar.baz}}',
	{ foo: false },
	'');

exports.dottedVariable5 = basicTest(
	'{{foo.bar.baz}}',
	{},
	'');

exports.dottedSection = basicTest(
	'{{#a.b}}ab{{/a.b}}',
	{ a: { b: [ 3, 1, 4, 1, 5 ] } },
	'ababababab');

exports.dottedProperty = basicTest(
	'{{a.length}},{{#a}}{{b}}{{/a}}',
	{ a: [ { b: 1 }, { b: 4 }, { b: 1 }] },
	'3,141');

////////////////////////////////////////////////////////////////////////////////
// Stack overflow //////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////

var stackDepthList = [];
for (var i = 0; i < 2000; i++) {
	stackDepthList.push({ c: 'a' });
}
exports.stackDepth = basicTest(
	'{{#list}}{{c}}{{/list}}',
	{ list: stackDepthList },
	new Array(2001).join('a'));

////////////////////////////////////////////////////////////////////////////////
// Partials ////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////

var files = {
	'/dir/a.html': '{{>b.html}}',
	'/dir/b.html': '{{foo}}',
	'/dir/tpl/c.html': '{{#bar}}d: {{>partials/d.html}}\n{{/bar}}',
	'/dir/partials/d.html': '{{baz}}, {{bal}}' };

function testWithPartials (filename, view, expected) {
	return function (test) {
		runtime.injectMockFs({
			readFile: function (filename, options, cb) { cb(null, files[filename]); },
			stat: function (filename, cb) { cb(null, { mtime: new Date(0) }); } });

		test.expect(2);

		runtime.render('/dir', filename, view, function (err, buffer) {
			test.equal(err, null);
			test.equal(buffer.toString(), expected);
			test.done();
		});
	};
}

exports.partialUndefined = testWithPartials(
	'a.html',
	{},
	'');

exports.partialVariable = testWithPartials(
	'a.html',
	{ foo: 3.1415 },
	'3.1415');

exports.partialNesting = testWithPartials(
	'tpl/c.html',
	{ baz: 'hello', bar: [ { baz: 'heya' }, { bal: 'world' } ] },
	'd: heya, \nd: hello, world\n');
