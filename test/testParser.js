var Parser = require('../lib/Parser');

function compareAst(text, expectedAst) {
	return function (test) {
		var parsedAst = (new Parser(text)).parse();
		test.deepEqual(parsedAst, expectedAst);
		test.done();
	};
}

exports.empty = compareAst(
	'',
	{ type: 'template', list: [] });

exports.simplest = compareAst(
	'foo',
	{ type: 'template', list: [ { type: 'text', content: 'foo' } ] });

exports.comment = compareAst(
	'fo{{! comment with a newline\nwoop }}o',
	{ type: 'template', list: [ { type: 'text', content: 'foo' } ] });

exports.singleVariable = compareAst(
	'foo {{bar}}',
	{ type: 'template',
	  list: 
	   [ { type: 'text', content: 'foo ' },
		 { type: 'variable',
		   tag: { key: [ 'bar' ], src: '{{bar}}', line: 1, col: 5 } } ] });

exports.twoVariables = compareAst(
	'{{foo}}{{bar}}',
	{ type: 'template',
	  list: 
	   [ { type: 'variable',
		   tag: { key: [ 'foo' ], src: '{{foo}}', line: 1, col: 1 } },
		 { type: 'variable',
		   tag: { key: [ 'bar' ], src: '{{bar}}', line: 1, col: 8 } } ] });

exports.variableWithWhitespace = compareAst(
	'foo {{  bar  }}',
	{ type: 'template',
	  list: 
	   [ { type: 'text', content: 'foo ' },
		 { type: 'variable',
		   tag: { key: [ 'bar' ], src: '{{  bar  }}', line: 1, col: 5 } } ] });

exports.textAfterVariable = compareAst(
	'foo {{bar}} baz',
	{ type: 'template',
	  list: 
	   [ { type: 'text', content: 'foo ' },
		 { type: 'variable',
		   tag: { key: [ 'bar' ], src: '{{bar}}', line: 1, col: 5 } },
		 { type: 'text', content: ' baz' } ] });


exports.partial = compareAst(
	'foo {{>example}} baz',
	{ type: 'template',
	  list: 
	   [ { type: 'text', content: 'foo ' },
		 { type: 'partial',
		   tag: { key: 'example', src: '{{>example}}', line: 1, col: 5 } },
		 { type: 'text', content: ' baz' } ] });


exports.partialWithWhitespace = compareAst(
	'foo {{> example}} baz',
	{ type: 'template',
	  list: 
	   [ { type: 'text', content: 'foo ' },
		 { type: 'partial',
		   tag: { key: 'example', src: '{{> example}}', line: 1, col: 5 } },
		 { type: 'text', content: ' baz' } ] });


exports.partialWithPath = compareAst(
	'foo {{> foo/example.html}} baz',
	{ type: 'template',
	  list: 
	   [ { type: 'text', content: 'foo ' },
		 { type: 'partial',
		   tag: 
		    { key: 'foo/example.html',
		      src: '{{> foo/example.html}}',
		      line: 1,
		      col: 5 } },
		 { type: 'text', content: ' baz' } ] });


exports.unescapedVariable = compareAst(
	'foo {{{bar}}}s',
	{ type: 'template',
	  list: 
	   [ { type: 'text', content: 'foo ' },
		 { type: 'unescaped',
		   tag: { key: [ 'bar' ], src: '{{{bar}}}', line: 1, col: 5 } },
		 { type: 'text', content: 's' } ] });


exports.emptySection = compareAst(
	'{{#foo}}{{/foo}}',
	{ type: 'template',
	  list: 
	   [ { type: 'section',
		   openTag: { key: [ 'foo' ], src: '{{#foo}}', line: 1, col: 1 },
		   closeTag: { key: [ 'foo' ], src: '{{/foo}}', line: 1, col: 9 },
		   list: [] } ] });


exports.emptyInvertedSection = compareAst(
	'{{^foo}}{{/foo}}',
	{ type: 'template',
	  list: 
	   [ { type: 'inverted',
		   openTag: { key: [ 'foo' ], src: '{{^foo}}', line: 1, col: 1 },
		   closeTag: { key: [ 'foo' ], src: '{{/foo}}', line: 1, col: 9 },
		   list: [] } ] });


exports.simpleSection = compareAst(
	'{{#foo}}bar{{/foo}}',
	{ type: 'template',
	  list: 
	   [ { type: 'section',
		   openTag: { key: [ 'foo' ], src: '{{#foo}}', line: 1, col: 1 },
		   closeTag: { key: [ 'foo' ], src: '{{/foo}}', line: 1, col: 12 },
		   list: [ { type: 'text', content: 'bar' } ] } ] });


exports.sectionWithTagAtEnd = compareAst(
	'{{#foo}}a {{bar}}{{/foo}}',
	{ type: 'template',
	  list: 
	   [ { type: 'section',
		   openTag: { key: [ 'foo' ], src: '{{#foo}}', line: 1, col: 1 },
		   closeTag: { key: [ 'foo' ], src: '{{/foo}}', line: 1, col: 18 },
		   list: 
		    [ { type: 'text', content: 'a ' },
		      { type: 'variable',
		        tag: { key: [ 'bar' ], src: '{{bar}}', line: 1, col: 11 } } ] } ] });


exports.sectionWithTagAtStart = compareAst(
	'{{#foo}}{{bar}} b{{/foo}}',
	{ type: 'template',
	  list: 
	   [ { type: 'section',
		   openTag: { key: [ 'foo' ], src: '{{#foo}}', line: 1, col: 1 },
		   closeTag: { key: [ 'foo' ], src: '{{/foo}}', line: 1, col: 18 },
		   list: 
		    [ { type: 'variable',
		        tag: { key: [ 'bar' ], src: '{{bar}}', line: 1, col: 9 } },
		      { type: 'text', content: ' b' } ] } ] });


exports.sectionWithOnlyTag = compareAst(
	'{{#foo}}{{bar}}{{/foo}}',
	{ type: 'template',
	  list: 
	   [ { type: 'section',
		   openTag: { key: [ 'foo' ], src: '{{#foo}}', line: 1, col: 1 },
		   closeTag: { key: [ 'foo' ], src: '{{/foo}}', line: 1, col: 16 },
		   list: 
		    [ { type: 'variable',
		        tag: { key: [ 'bar' ], src: '{{bar}}', line: 1, col: 9 } } ] } ] });


exports.sectionWithStuffAround = compareAst(
	'a{{#foo}}b{{bar}}c{{/foo}}d',
	{ type: 'template',
	  list: 
	   [ { type: 'text', content: 'a' },
		 { type: 'section',
		   openTag: { key: [ 'foo' ], src: '{{#foo}}', line: 1, col: 2 },
		   closeTag: { key: [ 'foo' ], src: '{{/foo}}', line: 1, col: 19 },
		   list: 
		    [ { type: 'text', content: 'b' },
		      { type: 'variable',
		        tag: { key: [ 'bar' ], src: '{{bar}}', line: 1, col: 11 } },
		      { type: 'text', content: 'c' } ] },
		 { type: 'text', content: 'd' } ] });


exports.nestedSection = compareAst(
	'{{#foo}}{{#bar}}{{/bar}}{{/foo}}',
	{ type: 'template',
	  list: 
	   [ { type: 'section',
		   openTag: { key: [ 'foo' ], src: '{{#foo}}', line: 1, col: 1 },
		   closeTag: { key: [ 'foo' ], src: '{{/foo}}', line: 1, col: 25 },
		   list: 
		    [ { type: 'section',
		        openTag: { key: [ 'bar' ], src: '{{#bar}}', line: 1, col: 9 },
		        closeTag: { key: [ 'bar' ], src: '{{/bar}}', line: 1, col: 17 },
		        list: [] } ] } ] });


exports.dottedNames = compareAst(
	'{{foo.bar}}',
	{ type: 'template',
	  list: 
	   [ { type: 'variable',
		   tag: { key: [ 'foo', 'bar' ], src: '{{foo.bar}}', line: 1, col: 1 } } ] });

exports.quotedKey = compareAst(
	'{{"foo bar"}}',
	{ type: 'template',
	  list: 
	   [ { type: 'variable',
		   tag: { key: [ 'foo bar' ], src: '{{"foo bar"}}', line: 1, col: 1 } } ] });

exports.dottedString1 = compareAst(
	'{{foo."bar... }}\\"{{"}}',
	{ type: 'template',
	  list: 
	   [ { type: 'variable',
		   tag: 
		    { key: [ 'foo', 'bar... }}"{{' ],
		      src: '{{foo."bar... }}\\"{{"}}',
		      line: 1,
		      col: 1 } } ] });

exports.dottedString2 = compareAst(
	'{{foo.\'[]*\\\'bar?\'}}',
	{ type: 'template',
	  list: 
	   [ { type: 'variable',
		   tag: 
		    { key: [ 'foo', '[]*\'bar?' ],
		      src: '{{foo.\'[]*\\\'bar?\'}}',
		      line: 1,
		      col: 1 } } ] });

exports.dottedNumber = compareAst(
	'{{foo.5}}',
	{ type: 'template',
	  list: 
	   [ { type: 'variable',
		   tag: { key: [ 'foo', '5' ], src: '{{foo.5}}', line: 1, col: 1 } } ] });

exports.dottedMisc = compareAst(
	'{{foo."b(a)r".3.14baz."\\"\\""}}',
	{ type: 'template',
	  list: 
	   [ { type: 'variable',
		   tag: 
		    { key: [ 'foo', 'b(a)r', '3', '14baz', '""' ],
		      src: '{{foo."b(a)r".3.14baz."\\"\\""}}',
		      line: 1,
		      col: 1 } } ] });

function parseError(text, expectedError) {
	return function (test) {
		test.throws(function () {
			(new Parser(text)).parse();
		}, expectedError);
		test.done();
	};
}

exports.badIdentifier1 = parseError('{{ }}',            /Expected key part on line 1, col 4/);
exports.badIdentifier2 = parseError('\n{{ }}',          /Expected key part on line 2, col 4/);
exports.badIdentifier3 = parseError('foo {{ }}',        /Expected key part on line 1, col 8/);
exports.badIdentifier4 = parseError('foo\nbar {{ }}',   /Expected key part on line 2, col 8/);
exports.badIdentifier5 = parseError('foo\r\nbar {{ }}', /Expected key part on line 2, col 8/);
exports.badIdentifier6 = parseError('\r\n{{}}',         /Expected key part on line 2, col 3/);
exports.badIdentifier7 = parseError('{{!\n}}\n{{}}',    /Expected key part on line 3, col 3/);
exports.badIdentifier8 = parseError('{{}}',             /Expected key part on line 1, col 3/);
exports.badIdentifier9 = parseError('{{',               /Expected key part on line 1, col 3/);

exports.unexpectedClose = parseError(
	'foo {{/close}} bar',
	/Unexpected close tag on line 1, col 5/);

exports.unmatchedClose = parseError(
	'foo {{^bar}}hey, {{/baz}}',
	/Expected close tag for {{\^bar}} but found {{\/baz}} on line 1, col 18/);

exports.unmatchedDottedClose = parseError(
	'foo {{^foo.bar}}hey, {{/baz}}',
	/Expected close tag for {{\^foo.bar}} but found {{\/baz}} on line 1, col 22/);

exports.missingClose = parseError(
	'foo {{^bar}}hey, {{baz}}',
	/Expected close tag for {{\^bar}} on line 1, col 25/);

exports.missingPartial = parseError(
	'{{>}}',
	/Expected partial name on line 1, col 4/);

exports.missingBrace1 = parseError(
	'hey {{foo} bar',
	/Expected "}}" on line 1, col 10/);

exports.missingBrace2 = parseError(
	'hey {{#foo}}bar {{/foo}baz',
	/Expected "}}" on line 1, col 23/);

exports.missingBrace3 = parseError(
	'hey {{{foo}} bar',
	/Expected "}}}" on line 1, col 11/);

exports.unclosedComment = parseError(
	'hey {{! how are you?',
	/Unclosed comment starting on line 1, col 5/);

exports.troublesomeComment = parseError(
	'{{^you}} {{! how are {{/you}}?',
	/Expected close tag for {{\^you}} on line 1, col 31/);

exports.troublesomeDots1 = parseError(
	'{{.foo}}',
	/Expected key part on line 1, col 3/);

exports.troublesomeDots2 = parseError(
	'{{foo.}}',
	/Expected key part on line 1, col 7/);

exports.troublesomeDots3 = parseError(
	'{{"foo" bar}}',
	/Expected "}}" on line 1, col 9/);

exports.troublesomeQuotes = parseError(
	'{{""}}',
	/Expected quoted key part on line 1, col 4/);

exports.unclosedQuote1 = parseError(
	'{{"foo',
	/Unclosed quote in key part on line 1, col 3/);

exports.unclosedQuote2 = parseError(
	'{{#"foo}}{{/foo}}',
	/Unclosed quote in key part on line 1, col 4/);

exports.characterShouldBeQuoted = parseError(
	'{{foo?}}',
	/Unexpected character on line 1, col 6/);

exports.missingDotAfterQuotedPart = parseError(
	'{{"foo"bar}}',
	/Unexpected character on line 1, col 8/);
