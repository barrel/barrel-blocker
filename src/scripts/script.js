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
		framerate: 58,
		actualFPS: null,
		viewingAngle: 20,
		world: {
			width: null,
			height: null
		},
		rooms: {},
		camera: {
			x: null,
			y: null
		},
		characters: {
			player: {
				dir: null,
				domObj : null,
				x: null,
				y: null,
				bb: {
					width: 0.1,
					height: 0.1
				}
			},
			npcs: []
		},
		currentRoom: null,
		collisionMatrix: {
			x: {},
			y: {}
		},
		floorTiles: [],
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
		
		/*
		*	INITIALIZE
		*	@arg: url / url of JSON level file
		*
		*	Instantiates game on world DOM object.
		*/
		
		init: function(url){
			return this.each(function(){
				game.$world = $(this);
				game.getLevelData(url);
			});
		},
		
		/*
		*	GET LEVEL DATA
		*	@arg: url / url of JSON level file
		*
		*	Loads JSON level file and declares misc object vars.
		*/

		getLevelData: function(url){
			$.ajax({
				dataType: "json",
				url: url,
				success: function(data){
					game.levelData = data.level;
					game.prefix = game.getPrefix();
					game.tile = typeof game.levelData.tile !== 'undefined' ? game.levelData.tile : game.tile;
					game.world.width = game.tile * game.levelData.world.width;
					game.world.length = game.tile * game.levelData.world.length;
					$.extend(game.characters.player, {
						x: game.levelData.startPos[0],
						y: game.levelData.startPos[1]
					});
					game.camera = {
						x: game.tile * ((game.levelData.world.width / 2) - game.characters.player.x),
						y: -game.tile * ((game.levelData.world.length / 2) - game.characters.player.y)
					};
					
					var cameraTransform = game.getTransformCSS(game.camera, 'rotateX('+game.viewingAngle+'deg)');
					
					game.$world.css({
						width: game.world.width+'px',
						height: game.world.length+'px',
						margin: (game.world.length / -2)+'px 0 0 '+(game.world.width / -2)+'px'
					}).css(cameraTransform);

					game.renderEnvironment();
				},
				error: function(error){
					alert('JSON PARSE ERROR!');
					console.info(error)
				}
			});
		},
		
		/*
		*	RENDER ENVIRONMENT
		*	
		*	Renders rooms, walls, and floors.
		*	Adds walls to collision matrix.
		*/

		renderEnvironment: function(){
			
			// FOR EACH ROOM
			
			$.each(game.levelData.rooms, function(){
				
				// CREATE ROOM
				
				var room = this,
					$room = $('<div class="room" id="'+room.roomname+'"/>').appendTo(game.$world);
					
				// POSITION ROOM
					
				var styles = {};
				
				for(var i = 0; i < 2; i++){
					var prefix = i == 0 ? game.prefix : '';
					styles[prefix+'transform'] = 'translate3d('+game.tile * room.origin[0]+'px, '+(game.world.length - (game.tile * room.origin[1]))+'px, 0)';
				};
			
				$room.css(styles);
				
				// BUILD ROOM OBJECT
				
				game.rooms[room.roomname] = {
					domNode: $room[0],
					floor: [],
					absOrigin: room.origin
				};
				
				// FOR EACH WALL
				
				$.each(room.walls,function(){
					var wall = this,
						negative = -wall.length > 0 ? true : false,
						className = (negative ? ' negative' : '') + (wall.backfaceVisible ? ' backface' : ''),
						pxLength = negative ? -wall.length : wall.length,
						$wall = $('<div class="wall '+wall.axis+'-plane'+className+'" style="background-color: '+wall.background+'"/>').appendTo($room),
						translateX,
						translateY;	
						
					$wall.css({
						'width': game.tile * pxLength+'px',
						'height': game.tile * 4
					});
					
					if(wall.axis == 'x'){
						translateX = (wall.origin[0] + wall.length) * game.tile;
						translateY = -wall.origin[1] * game.tile;
						rotate = negative ? 'rotateX(90deg) rotateY(0deg)':
						 					'rotateX(90deg) rotateY(180deg)';
					} else {
						translateX = wall.origin[0] * game.tile;
						translateY = -(wall.origin[1] + wall.length) * game.tile;
						rotate = negative ? 'rotateX(90deg) rotateY(270deg)':
						 					'rotateX(90deg) rotateY(90deg)';
					};
					
					var styles = {};	
					
					for(var i = 0; i < 2; i++){
						var prefix = i == 0 ? game.prefix : '';
						styles[prefix+'transform'] = 'translate3d('+translateX+'px, '+translateY+'px, 0px) '+rotate;
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
							domNode: $wall[0]
						};
						
					collisionObject[wall.axis+'Min'] = perpStart > perpEnd ? perpEnd : perpStart;
					collisionObject[wall.axis+'Max'] = perpStart > perpEnd ? perpStart : perpEnd;
					
					entry.push(collisionObject);
					
					// MAP FLOOR TILES
					
					if(wall.axis == 'y' && !negative){
						var currentTile = [
								wall.origin[0],
								wall.origin[1]
							],
							rows = [];
						
						for(currentTile[1] = wall.origin[1]; currentTile[1]<wall.origin[1]+wall.length; currentTile[1]++){
							var row = [];

							row.push([currentTile[0],currentTile[1]]);
						   
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
										return;
									};
								});
								if(endRow){
									rows.push(row);
									break;
								} else {
									row.push([currentTile[0],currentTile[1]]);
								};
							};
							currentTile[0] = wall.origin[0]
						};
						
						// OPTIMIZE FLOOR MAP
						
						var quads = [],
							index = 0;
						
						$.each(rows, function(i){
							var row = this;
							if(typeof quads[index] === 'undefined'){
								quads[index] = {
									origin: row[0],
									width: row.length,
									height: 1
								};
							}
							if(i < rows.length-1 && row.length == rows[i+1].length){
								quads[index].height++;
							} else {
								index++;
							};
						});
						
						game.renderFloorTiles($room, room, quads);
					
					};
						
				});
				
			});
			
			game.renderFurniture();
		},
		
		/*
		*	RENDER FLOOR TILES
		*	@arg: 	$room / jQuery object
		*	@arg: 	quads / Array of optimized quadrilaterals
		*
		*	Appends floor tiles to room.
		*	Adds floor meta data to game object.			
		*/
		
		renderFloorTiles: function($room, room, quads){
			$.each(quads,function(){
				var quad = this,
					$floorTile = $('<div class="floortile" style="background: '+room.floor.background+'"/>').appendTo($room),
					pos = game.positionInPixels(quad),
					absOrigin = [
						quad.origin[0] + room.origin[0],
						quad.origin[1] + room.origin[1]
					];
					
				quad.domNode = $floorTile[0];
				
				game.rooms[room.roomname].floor.push(quad);
				game.floorTiles.push({
					parentRoom: room.roomname,
					parentdomNode: $room[0],
					absOrigin: absOrigin,
					xMin: absOrigin[0],
					xMax: absOrigin[0] + quad.width,
					yMin: absOrigin[1],
					yMax: absOrigin[1] + quad.height
				});
				
				var styles = {};

				for(var i = 0; i < 2; i++){
					var prefix = i == 0 ? game.prefix : '';
					styles[prefix+'transform'] = 'translate3d('+pos.x+'px, '+pos.y+'px, 0px)';
				};

				$floorTile.css({
					width: game.tile * quad.width+'px',
					height: game.tile * quad.height+'px'
				}).css(styles);
				
			});
			
		},
		
		/*
		*	RENDER FURNITURE
		*
		*	Renders 2D & 3D furniture objects and adds to collision matrix.		
		*/

		renderFurniture: function(){
			
			// EMPTY
			
			game.renderChars();
		},
		
		/*
		*	RENDER CHARACTERS
		*
		*	Renders player and all NPCs.
		*/

		renderChars: function(){
			
			game.$player = $('<div class="char player"><div class="avatar"/></div>').appendTo(game.$world);
			$.extend(game.characters.player,{ 
				dir: 'up',
				domObj: game.$player[0],
				x: game.levelData.startPos[0],
				y: game.levelData.startPos[1]	
			});
			game.currentRoom = game.detectRoom(game.characters.player);
			game.$player.attr('data-room',game.currentRoom.roomname);
			
			game.$player.css({
				width: (game.characters.player.bb.width * game.tile)+'px',
				height: (game.characters.player.bb.height * game.tile)+'px'
			});
			
			game.moveCharacter(game.characters.player);
			
			game.bindControls();
		},
		
		/*
		*	BIND CONTROLS
		*
		*	Binds movement loops to key codes,
		*	Listens for keyup/down.
		*/

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
			
			game.draw();
			game.play();
		},
		
		/*
		*	MOVE
		*	@arg: direction / string
		*	
		*	Calculates player and camera positions.
		*	Updates new positions if no collisions.
		*/
		
		move: function(direction){
			
			var newPlayerPos = {
					x: game.characters.player.x,
					y: game.characters.player.y
				},
				newCameraPos = {
					x: game.camera.x,
					y: game.camera.y
				};
			
			if(direction == 'up'){
				newPlayerPos.y = (game.characters.player.y + game.speed).toFixed(1) * 1;
				newCameraPos.y = (game.camera.y + (game.speed * game.tile)).toFixed(1) * 1;
			} else if(direction == 'down'){
				newPlayerPos.y = (game.characters.player.y - game.speed).toFixed(1) * 1;
				newCameraPos.y = (game.camera.y - (game.speed * game.tile)).toFixed(1) * 1;
			} else if(direction == 'left'){
				newPlayerPos.x = (game.characters.player.x - game.speed).toFixed(1) * 1;
				newCameraPos.x = (game.camera.x + (game.speed * game.tile)).toFixed(1) * 1;
			} else if(direction == 'right'){
				newPlayerPos.x = (game.characters.player.x + game.speed).toFixed(1) * 1;
				newCameraPos.x = (game.camera.x - (game.speed * game.tile)).toFixed(1) * 1;
			};
			
			// PASS POSITION TO COLLISION AND ROOM DETECTION
			
			var collision = game.detectCollision(newPlayerPos, direction, game.characters.player.bb);
				
			
			if(!collision.collided){
				$.extend(game.characters.player,{
					dir: direction,
					x: newPlayerPos.x,
					y: newPlayerPos.y
				});
				game.camera = newCameraPos;
				game.currentRoom = game.detectRoom(game.characters.player);
				game.$player.attr('data-room',game.currentRoom.roomname);
			} else {
				return false;
			};
			
			game.moveCharacter(game.characters.player)
		},
		
		/*
		*	MOVE CHARACTER
		*	@arg: player / Player object
		*
		*	Updates translation values for character;
		*/
		
		moveCharacter: function(character){
			var translate = game.positionInPixels({
				width: 1,
				height: 1,
				origin: [character.x,character.y]
			});
			
			$(character.domObj).data('translate',translate);
		},
		
		/*
		*	DETECT COLLISION
		*	@arg: position / Absolute co-ordinate array
		*	@arg: direction / String
		*	@arge: bb / bounding box width+height array
		* 	return collision object
		*
		*	Checks player position against all objects in collision matrix on perpendicular axis.
		*/
		
		detectCollision: function(position, direction, bb){
			var collision = false,
				edge = {};
	
			edge.x = direction == 'right' ? position.x + bb.width : position.x; 
			edge.y = direction == 'up' ? position.y + bb.height : position.y;
			
			for(i = 0; i < 2; i++){
				var axis = i == 0 ? 'x' : 'y',
					perpAxis = i == 0 ? 'y' : 'x';
					
				if(typeof game.collisionMatrix[axis][edge[axis]] !== 'undefined'){
					$.each(game.collisionMatrix[axis][edge[axis]], function(i){
						var collisionObject = this;
						if(
							game.characters.player[perpAxis] >= collisionObject[perpAxis+'Min'] && 
							game.characters.player[perpAxis] <= collisionObject[perpAxis+'Max']
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
		
		/*
		*	DETECT COLLISION
		*	@arg: position / Absolute co-ordinate array
		*	return roomname and dom node
		*
		*	Checks player position against all objects in collision matrix on perpendicular axis.
		*/
		
		detectRoom: function(position){
			var index = null
			$.each(game.floorTiles, function(i){
				floorTile = this;
				if(
					game.characters.player.x >= floorTile.xMin &&
					game.characters.player.x <= floorTile.xMax &&
					game.characters.player.y >= floorTile.yMin &&
					game.characters.player.y <= floorTile.yMax
				){
					index = i;
				}
			});
			
			return {
				roomname: game.floorTiles[index].parentRoom,
				domNode: game.floorTiles[index].domNode
			};
		},
		
		/*
		*	DRAW
		*
		*	Global front-end redraw function
		*/
		
		draw: function(){
			
			var startFrame = new Date().getTime(),
				refresh = setInterval(function(){
				
				// REDRAW PLAYER
				
				var playerTransform = game.getTransformCSS(game.$player.data('translate'));
				
				game.$player.css(playerTransform);
				
				// REDRAW NPCs
				
				
				
				// REDRAW CAMERA
				
				var cameraTransform = game.getTransformCSS(game.camera, 'rotateX('+game.viewingAngle+'deg)');

				game.$world.css(cameraTransform);
				
				// UPDATE HUD
				
				$('#RoomName').text(game.currentRoom.roomname);
				$('#FPS').text(game.actualFPS+'fps');
				
				// GET FRAMERATE
				
				var endFrame = new Date().getTime(),
					frameDuration = endFrame - startFrame;
					game.actualFPS = (1000/frameDuration).toFixed(1);
					startFrame = endFrame;
				
			},1000/game.framerate);
			
		},
		
		getTransformCSS: function(translate, rotate){
			rotate = rotate ? rotate : '';
			var styles = {};
			for(var i = 0; i < 2; i++){
				var prefix = i == 0 ? game.prefix : '';
				styles[prefix+'transform'] = 'translate3d('+translate.x+'px, '+translate.y+'px, 0) '+rotate;
			};
			return styles;
		},
		
		/*
		*	PLAY
		*
		*	Manages HUD, interactions, scoring etc
		*/

		play: function(){
			
			alert('Welcome to Barrelblocker! - Use WASD to move.');
			console.info(game);

		},
		
		/*
		*	POSITION IN PIXELS
		*	@arg: obj / Object containing width, height and origin
		*	return co-ordinate object for translate3d
		*
		*	Positions a quadrilateral object in pixel space
		*/
		
		positionInPixels: function(obj){
			var pixelX = obj.origin[0] * game.tile,
				pixelY = (obj.origin[1] * game.tile) + (obj.height * game.tile);
				
			return {
				x: pixelX.toFixed() * 1,
				y: -pixelY.toFixed() * 1
			};
		},
		
		/*
		*	GET PREFIX
		*	return prefix string or false	
		*
		*	Gets vendor prefix for current browser.
		*	Returns false if no transition support.
		*/

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
	
	/*
	*	DECLARE BARREL BLOCKER METHOD
	*/

	$.fn.barrelBlocker = function(url){
		return game.init.apply(this, arguments);
	};

})(jQuery);

/* --- DOM READY --- */

$(function() {
	$('#World').barrelBlocker('test.json');
});