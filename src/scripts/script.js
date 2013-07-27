/* --- EXTENSIONS & GLOBAL FUNCTIONS --- */

/*
* jQuery .removeStyle() method
* Author: Patrick Kunka 2013
*/

$.fn.removeStyle=function(a){return this.each(function(){var b=$(this);a=a.replace(/\s+/g,"");var c=a.split(",");$.each(c,function(){var c=RegExp(this.toString()+"[^;]+;?","g");b.attr("style",function(b,a){if(a)return a.replace(c,"")})});"undefined"!==b.attr("style")&&(c=b.attr("style").replace(/\s{2,}/g," ").trim(),b.attr("style",c),""==c&&b.removeAttr("style"))})};



/* --- GAME --- */

(function($){

	var game = {
		prefix: false,
		$world: null,
		$player: null,
		levelData: null,
		tile: 100,
		speed: 8,
		framerate: 50,
		world: {
			width: null,
			height: null
		},
		position: {
			x: null,
			y: null
		},
		controls: {
			keycodes: {
				up: 87,
				down: 83,
				left: 65,
				right: 68
			},
			states: {
				up: false,
				down: false,
				left: false,
				right: false
			}
		},
		movements: {
			up: null,
			down: null,
			left: null,
			right: null
		},
		init: function(url){
			return this.each(function(){
				game.prefix = game.getPrefix();
				game.$world = $(this);
				game.getLevelData(url);
			});
		},

		getLevelData: function(url){
			$.getJSON(url, function(data){
				game.levelData = data.level;
				game.renderEnvironment();
			});
		},

		renderEnvironment: function(){
			game.tile = typeof game.levelData.tile !== 'undefined' ? game.levelData.tile : game.tile;
			game.world.width = game.tile * game.levelData.world.width;
			game.world.length = game.tile * game.levelData.world.length;
			game.position = {
				x: game.tile * ((game.levelData.world.width / 2) - game.levelData.startPos[0]),
				y: -game.tile * ((game.levelData.world.length / 2) - game.levelData.startPos[1])
			};
			
			var styles = {};
			
			for(var i = 0; i < 2; i++){
				var prefix = i == 0 ? game.prefix : '';
				styles[prefix+'transform'] = 'translate3d('+game.position.x+'px, '+game.position.y+'px, 0) rotateX(30deg)';
			};
			
			
			game.$world.css({
				width: game.world.width+'px',
				height: game.world.length+'px',
				margin: (game.world.length / -2)+'px 0 0 '+(game.world.width / -2)+'px'
			}).css(styles);
			
			// FOR EACH ROOM
			
			$.each(game.levelData.rooms, function(){
				
				// CREATE ROOM
				
				var room = this,
					$room = $('<div class="room" id="'+this.roomname+'"/>').appendTo(game.$world);
					
				var styles = {};
				
				for(var i = 0; i < 2; i++){
					var prefix = i == 0 ? game.prefix : '';
					styles[prefix+'transform'] = 'translate3d('+game.tile * this.origin[0]+'px, '+(game.world.length - (game.tile * this.origin[1]))+'px, 0)';
				};
				
				// POSITION ROOM
			
				$room.css(styles);
				
				// FOR EACH WALL
				
				$.each(room.walls,function(){
					var wall = this,
						negative = -wall.length > 0 ? true : false,
						length = negative ? -wall.length : wall.length,
						$wall = $('<div class="wall '+wall.axis+'-plane" style="background-color: '+wall.background+'"/>').appendTo($room),
						x,
						y;
						
						
					$wall.css({
						'width': game.tile * length+'px',
						'height': game.tile * 4
					});
					
					if(wall.axis == 'x'){
						y = -wall.origin[1] * game.tile;
						x = negative ? (game.tile * wall.origin[0]) - (game.tile * length) : game.tile * wall.origin[0];
					} else {
						x = wall.origin[0] * game.tile;
						y = negative ? -((game.tile * wall.origin[1]) - (game.tile * length)) : -game.tile * wall.origin[1];
					};
					
					var styles = {},
						rotate = wall.axis == 'x' ? 'rotateX(90deg)' : 'rotateZ(270deg) rotateX(90deg)';
					
					for(var i = 0; i < 2; i++){
						var prefix = i == 0 ? game.prefix : '';
						styles[prefix+'transform'] = 'translate3d('+x+'px, '+y+'px, 0px) '+rotate;
					};
					
					$wall.css(styles);
						
				});
			});
			
			game.renderFurniture();
		},

		renderFurniture: function(){
			
			game.renderChars();
		},

		renderChars: function(){
			
			game.$player = $('<div class="char player"/>').insertAfter(game.$world);
			
			game.$player.css({
				width: game.tile+'px',
				height: 2 * game.tile+'px'
			});
			
			game.$player.css({
				width: game.tile+'px',
				height: 2 * game.tile+'px'
			});
			
			game.bindControls();
		},

		bindControls: function(){
			var keycodes = game.controls.keycodes,
				keystates = game.controls.states;
				
			function checkKey(keycode){
				var key;
				if(keycode == keycodes.up){
					key = 'up';
				} else if(keycode == keycodes.down){
					key = 'down';
				} else if(keycode == keycodes.left){
					key = 'left';
				} else if(keycode == keycodes.right){
					key = 'right';
				};
				return key;
			};
				
			$(window).on({
				keydown: function(e){
					var key = checkKey(e.keyCode);
						
					if(!keystates[key]){
							keystates[key] = true;
							game.$player.removeClass('up down left right').addClass(key);
							game.movements[key] = setInterval(function(){
								game.move(key);
							},1000/game.framerate);
					};
				},
				keyup: function(e){
					var key = checkKey(e.keyCode);
					
					if(keystates[key]){
						keystates[key] = false;
						clearInterval(game.movements[key]);
					};
				}
			});
		},
		
		move: function(direction){
			if(direction == 'up'){
				game.position.y = game.position.y + game.speed;
			} else if(direction == 'down'){
				game.position.y = game.position.y - game.speed;
			} else if(direction == 'left'){
				game.position.x = game.position.x + game.speed;
			} else if(direction == 'right'){
				game.position.x = game.position.x - game.speed;
			};
			
			var styles = {};
			
			for(var i = 0; i < 2; i++){
				var prefix = i == 0 ? game.prefix : '';
				styles[prefix+'transform'] = 'translate3d('+game.position.x+'px, '+game.position.y+'px, 0) rotateX(30deg)';
			};
			
			game.$world.css(styles);
		},

		play: function(){

		},

		getPrefix: function(){
			var $el = $('body'),
				el = $el[0],
				prefixes = ["Webkit", "Moz", "O", "ms"];
		
			for (var i = 0; i < prefixes.length; i++){
				if (prefixes[i] + "Transition" in el.style){
					$el.attr('style') == '' && $el.removeAttr('style');
					return '-'+prefixes[i].toLowerCase()+'-'; 
				};
			};
			return "transition" in el.style ? "" : false;
		}

	};

	$.fn.barrelBlocker = function(url){
		return game.init.apply(this, arguments);
	};

})(jQuery);

/* --- DOM READY --- */

$(function() {
	$('#World').barrelBlocker('test.json');
});