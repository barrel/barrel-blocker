var room = {
	el: '#room',
	wallTpl: '#wallTpl',

	init: function(url) {
		var self = this;

		self.$el = $(self.el);
		self.hbsWall = Handlebars.compile($(self.wallTpl).html());

		self.getRoomData(url);

		$('body').on('click', function() {
			self.$el.toggleClass('panning');
		});
	},

	getRoomData: function(url) {
		var self = this;

		$.getJSON(url, function(data) {
			self.createRoom(data);
		});
	},

	createRoom: function(roomData) {
		var self = this,
			level = roomData.level,
			position = {
				x: 0,
				z: 0
			};

		$.each(level.walls, function() {
			var $wall = $(self.hbsWall(this));

			var x = position.x,
				z = position.z;

			var wallTransforms = {
				'north': '',
				'east': 'rotateY(90deg)',
				'west': 'rotateY(90deg)',
				'south': 'rotateY(180deg)'
			}

			if(this.direction == 'north') {
				position.x += Number(this.length);
			} else if(this.direction == 'east') {
				position.z += Number(this.length);
				x -= this.length;
			} else if(this.direction == 'west') {
				position.z -= Number(this.length);
			} else if(this.direction == 'south') {
				position.x -= Number(this.length);
			}

			x = x ? x * 100+'px' : '0';
			z = z ? z * 100+'px' : '0';

			$wall.data('transform-string', 'translate3d('+x+', 0, '+z+') '+wallTransforms[this.direction]);

			$wall.appendTo('#room').css({
				'transform': $wall.data('transform-string')
			});
		});

		$('.floor').css('background', level.floor.background);
	}
}

$(function() {
	room.init('room.json');
});