/* --- BARRELBLOCKER ENGINE --- */

(function($){

	var game = {
		prefix: false,
		$world: null,
		$player: null,
		levelData: null,
		tile: 100,
		speed: 0.1,
		cameraSpeed: null,
		framerate: 50,
		viewingAngle: 30,
		world: {
			width: null,
			height: null
		},
		camera: {
			x: null,
			y: null
		},
		player: {
			x: null,
			y: null
		},
		collisionMatrix:{
			x: {},
			y: {}
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
				
				game.tile = typeof game.levelData.tile !== 'undefined' ? game.levelData.tile : game.tile;
				game.world.width = game.tile * game.levelData.world.width;
				game.world.length = game.tile * game.levelData.world.length;
				game.player = {
					x: game.levelData.startPos[0],
					y: game.levelData.startPos[1]
				};
				game.camera = {
					x: game.tile * ((game.levelData.world.width / 2) - game.player.x),
					y: -game.tile * ((game.levelData.world.length / 2) - game.player.y)
				};
				game.cameraSpeed = game.speed * game.tile;
				game.moveCamera();
				game.$world.css({
					width: game.world.width+'px',
					height: game.world.length+'px',
					margin: (game.world.length / -2)+'px 0 0 '+(game.world.width / -2)+'px'
				});
				
				game.renderEnvironment();
			});
		},

		renderEnvironment: function(){
			
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
					
					// ADD TO COLLISION MATRIX
					
					var absoluteOrigin = [
							wall.origin[0] + room.origin[0],
							wall.origin[1] + room.origin[1]
						],
						collideWith = wall.axis == 'x' ? 'y' : 'x',
						axisPos = wall.axis == 'x' ? 1 : 0,
						perpAxisPos = wall.axis == 'x' ? 0 : 1;
					
					if(typeof game.collisionMatrix[collideWith][absoluteOrigin[axisPos]] === 'undefined'){
						game.collisionMatrix[collideWith][absoluteOrigin[axisPos]] = [];
					};
						
					var entry = game.collisionMatrix[collideWith][absoluteOrigin[axisPos]],
						perpStart = absoluteOrigin[perpAxisPos],
						perpEnd = absoluteOrigin[perpAxisPos] + wall.length,
						collisionObject = {
							objectType: 'wall',
							domObj: $wall[0]
						};
						
					collisionObject[wall.axis+'Min'] = perpStart > perpEnd ? perpEnd : perpStart;
					collisionObject[wall.axis+'Max'] = perpStart > perpEnd ? perpStart : perpEnd;
					
					entry.push(collisionObject);
					
					// MAP FLOOR TILES
					
					if(wall.axis == 'y' && !negative){
						var currentTile = [
								wall.origin[0],
								wall.origin[1]
							];
						
						for(i = 0; i<wall.length; i++){
						
							game.renderFloorTile($room, currentTile);
						   
							for(var j = 0; j<game.levelData.world.width; j++){
								currentTile[0]++;
								var endRow = false;
								$.each(room.walls, function(){
									if(
										this.axis == 'y' && 
										-this.length > 0 &&
										this.origin[0] == currentTile[0] &&
										currentTile[1] < this.origin[1] &&
										currentTile[1] >= this.origin[1] + this.length
									){
										endRow = true;
										return false;
									};
								});
								if(endRow){
									break;
								} else {
									game.renderFloorTile($room, currentTile);
								};
							};
							currentTile[0] = wall.origin[0]
							currentTile[1]++;
						};
					
					};
						
				});
				
			});
			
			game.renderFurniture();
		},
		
		renderFloorTile: function($room, origin){
			var $floorTile = $('<div class="floortile"/>').appendTo($room),
				pos = game.originToPixels(origin),
				styles = {};
			
			for(var i = 0; i < 2; i++){
				var prefix = i == 0 ? game.prefix : '';
				styles[prefix+'transform'] = 'translate3d('+pos.x+'px, '+pos.y+'px, 0px)';
			};
			
			$floorTile.css({
				width: game.tile+'px',
				height: game.tile+'px'
			}).css(styles);	
		},

		renderFurniture: function(){
			
			// EMPTY
			
			game.renderChars();
		},

		renderChars: function(){
			
			game.$player = $('<div class="char player"/>').insertAfter(game.$world);
			game.player = {
				x: game.levelData.startPos[0],
				y: game.levelData.startPos[1]
			};
			
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
								game.movePlayer(key);
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
			
			game.play();
		},
		
		movePlayer: function(direction){
			
			var newPlayerPos = {
					x: game.player.x,
					y: game.player.y
				},
				newCameraPos = {
					x: game.camera.x,
					y: game.camera.y
				};
			
			if(direction == 'up'){
				newPlayerPos.y = (game.player.y + game.speed).toFixed(1) * 1;
				newCameraPos.y = game.camera.y + game.cameraSpeed;
			} else if(direction == 'down'){
				newPlayerPos.y = (game.player.y - game.speed).toFixed(1) * 1;
				newCameraPos.y = game.camera.y - game.cameraSpeed;
			} else if(direction == 'left'){
				newPlayerPos.x = (game.player.x - game.speed).toFixed(1) * 1;
				newCameraPos.x = game.camera.x + game.cameraSpeed;
			} else if(direction == 'right'){
				newPlayerPos.x = (game.player.x + game.speed).toFixed(1) * 1;
				newCameraPos.x = game.camera.x - game.cameraSpeed;
			};
			
			// DETECT COLLISIONS
			
			var collision = game.detectCollision(newPlayerPos);
			
			if(!collision.collided){
				game.player = newPlayerPos;
				game.camera = newCameraPos;
			} else {
				return false;
			};
			
			game.moveCamera();
		},
		
		moveCamera: function(){
			var styles = {};
			
			for(var i = 0; i < 2; i++){
				var prefix = i == 0 ? game.prefix : '';
				styles[prefix+'transform'] = 'translate3d('+game.camera.x+'px, '+game.camera.y+'px, 0) rotateX('+game.viewingAngle+'deg)';
			};
			
			game.$world.css(styles);	
		},
		
		detectCollision: function(position){
			var collision = false;
			for(i = 0; i < 2; i++){
				var axis = i == 0 ? 'x' : 'y',
					perpAxis = i == 0 ? 'y' : 'x';
					
				if(typeof game.collisionMatrix[axis][position[axis]] !== 'undefined'){
					$.each(game.collisionMatrix[axis][position[axis]], function(i){
						var collisionObject = this;
						if(
							game.player[perpAxis] >= collisionObject[perpAxis+'Min'] && 
							game.player[perpAxis] <= collisionObject[perpAxis+'Max']
						){
							collision = {
								collided: true,
								object: collisionObject
							};
							return false;
						};
					});
				};
			};
			return collision;
		},

		play: function(){
			
			console.info(game)
			
			// EMPTY

		},
		
		originToPixels: function(origin){
			var pixelX = origin[0] * game.tile,
				pixelY = origin[1] * game.tile + game.tile;
				
			return {
				x: pixelX,
				y: -pixelY
			};
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