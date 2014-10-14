module.exports = Parser;

function Parser (text) {
	this.text = text;
	this.c = text[0];
	this.i = 0;
	this.line = 1;
	this.iAtEol = -1;
	this.mustaches = null;
}

Parser.prototype.parse = function parse () {
	var list = this.template();

	if (this.i < this.text.length) {
		this.err('Unexpected close tag');
	}

	return {
		type: 'template',
		list: list };
};

Parser.prototype.template = function template () {
	var list = [];
	var start = this.i;

	while (this.i < this.text.length) {
		if (this.look('{{')) {
			this.appendText(list, start);
			this.mustaches = this.location();

			if (this.text[this.i + 2] === '/') {
				return list;

			} else {
				this.eat(2);

				var item = this.item();
				if (item) {
					list.push(item);
				}

				start = this.i;
			}
		} else {
			this.eat();
		}
	}

	this.appendText(list, start);

	return list;
};

Parser.prototype.appendText = function appendText (list, start) {
	var text = this.text.substring(start, this.i);

	if (text.length) {
		// This is an optimizing parser!
		if (list.length && list[list.length - 1].type === 'text') {
			list[list.length - 1].content += text;

		} else {
			list.push({ type: 'text', content: text });
		}
	}
};

Parser.prototype.item = function item () {
	switch (this.c) {
		case '!':
			this.eat();
			return this.comment();

		case '#':
			this.eat();
			return this.section('section');

		case '^':
			this.eat();
			return this.section('inverted');

		case '>':
			this.eat();
			return {
				type: 'partial',
				tag: this.tag(false, true) };

		case '{':
			this.eat();
			return {
				type: 'unescaped',
				tag: this.tag(true) };

		default:
			return {
				type: 'variable',
				tag: this.tag(false) };
	}
};

Parser.prototype.tag = function tag (tripleStache, partial) {
	this.spaces();

	var start;
	var key;

	if (partial) {
		start = this.i;
		while (this.i < this.text.length && this.c !== '}' && this.c !== ' ') {
			this.eat();
		}

		if (start < this.i) {
			key = this.text.substring(start, this.i);
		} else {
			this.err('Expected partial name');
		}
	} else {
		key = [ this.tagPart() ];

		while (this.i < this.text.length && this.c !== '}' && this.c !== ' ') {
			if (this.c === '.') {
				this.eat();
				key.push(this.tagPart());
			} else {
				this.err('Unexpected character');
			}
		}
	}

	this.spaces();

	var expected = tripleStache ? '}}}' : '}}';
	if (this.look(expected)) {
		this.eat(expected.length);
	} else {
		this.err('Expected "' + expected + '"');
	}

	return {
		key: key,
		src: this.text.substring(this.mustaches.i, this.i),
		line: this.mustaches.line,
		col: this.mustaches.col };
};

Parser.prototype.tagPart = function tagPart () {
	var start;

	if (this.c === '"' || this.c === '\'') {
		var quote = this.c;
		var partLocation = this.location();
		this.eat();

		start = this.i;
		while (!this.look(quote)) {
			if (this.i >= this.text.length) {
				this.err('Unclosed quote in key part', partLocation);
			} else if (this.look('\\' + quote)) {
				this.eat(2);
			} else {
				this.eat();
			}
		}

		if (start < this.i) {
			var part = this.text.substring(start, this.i).replace(
				new RegExp('\\\\' + quote, 'g'), quote);
			this.eat();
			return part;
		} else {
			this.err('Expected quoted key part');
		}
	} else {
		start = this.i;
		while (this.i < this.text.length && (
				(this.c >= 'A' && this.c <= 'Z') || (this.c >= 'a' && this.c <= 'z') ||
				(this.c >= '0' && this.c <= '9') || this.c === '_')) {
			this.eat();
		}

		if (start < this.i) {
			return this.text.substring(start, this.i);
		} else {
			this.err('Expected key part');
		}
	}
};

Parser.prototype.section = function section (type) {
	var openTag = this.tag(false);
	var list = this.template();

	if (this.look('{{/')) {
		this.eat(3);

		var closeTag = this.tag(false);
		if (areKeysEqual(openTag.key, closeTag.key)) {
			return {
				type: type,
				openTag: openTag,
				closeTag: closeTag,
				list: list };

		} else {
			this.err('Expected close tag for ' + openTag.src + ' but found ' + closeTag.src,
				this.mustaches);
		}
	} else {
		this.err('Expected close tag for ' + openTag.src);
	}
};

Parser.prototype.comment = function comment () {
	while (this.i < this.text.length) {
		if (this.look('}}')) {
			this.eat(2);
			return;
		} else {
			this.eat();
		}
	}

	this.err('Unclosed comment starting', this.mustaches);
};

Parser.prototype.look = function look (chars) {
	for (var i = 0; i < chars.length; i++) {
		if (this.text[this.i + i] !== chars[i]) {
			return false;
		}
	}

	return true;
};

Parser.prototype.eat = function eat (num) {
	if (num === undefined) {
		num = 1;
	}

	for (var i = 0; i < num; i++) {
		if (this.c === '\n') {
			this.line++;
			this.iAtEol = this.i;
		}

		this.i++;
		this.c = this.text[this.i];
	}
};

Parser.prototype.spaces = function spaces () {
	while (this.c === ' ') {
		this.eat();
	}
};

Parser.prototype.location = function location () {
	return {
		i: this.i,
		line: this.line,
		col: this.i - this.iAtEol };
};

Parser.prototype.err = function err (message, location) {
	if (!location) {
		location = this.location();
	}

	throw new Error(message + ' on line ' + location.line + ', col ' + location.col);
};

function areKeysEqual (key1, key2) {
	if (key1.length !== key2.length) {
		return false;
	}

	for (var i = 0; i < key1.length; i++) {
		if (key1[i] !== key2[i]) {
			return false;
		}
	}

	return true;
}
