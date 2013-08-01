/* --- BARRELBLOCKER ENGINE --- */

(function($){

	var game = {
		prefix: false,
		$world: null,
		$player: null,
		levelData: null,
		tile: 100,
		speed: 1.3,
		cameraSpeed: null,
		framerate: 60,
		actualFPS: null,
		viewingAngle: 45,
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
				domNode : null,
				x: null,
				y: null,
				bb: {
					width: 1,
					height: 1
				}
			},
			npcs: []
		},
		moveables: {},
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
					
					var cameraTransform = game.getTransformCSS(game.camera, {x: game.viewingAngle, y: 0, z: 0});
					
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
					$room = $('<div class="room" id="'+room.roomname+'"/>').appendTo(game.$world),
					roomPos = {
						x: game.tile * room.origin[0],
						y: -(game.tile * room.origin[1])
					};
					
				// POSITION ROOM
					
				var roomTransform = game.getTransformCSS(roomPos);
				$room.css(roomTransform);
				
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
						className = (negative ? ' negative' : '') + (wall.backfaceVisible ? ' backface' : '') + (wall.portal ? ' portal' : ''),
						pxLength = negative ? -wall.length : wall.length,
						$wall = $('<div class="wall '+wall.axis+'-plane'+className+'" style="background: '+wall.background+'"/>').appendTo($room),
						translate = {},
						rotate = {};
						
					$wall.css({
						width: game.tile * pxLength+'px',
						height: game.tile * 3,
						marginBottom: -(game.tile * 3)+'px'
					});
					
					if(wall.axis == 'x'){
						translate.x = (wall.origin[0] + wall.length) * game.tile;
						translate.y = -wall.origin[1] * game.tile;
						rotate = negative ? {x: 90, y: 0, z: 0} : {x: 90, y: 180, z: 0};
					} else {
						translate.x = wall.origin[0] * game.tile;
						translate.y = -(wall.origin[1] + wall.length) * game.tile;
						rotate = negative ? {x: 90, y: 270, z: 0} : {x: 90, y: 90, z: 0};
					};
					
					$wall.data('translate',translate);
					$wall.data('rotate',rotate);
					
					var wallTransform = game.getTransformCSS(translate, rotate);	
				
					$wall.css(wallTransform);
					
					// ADD TO COLLISION MATRIX
					
					game.pushCollision($wall, wall, room);
					
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
				
				game.renderFurniture(room)
				
			});
			
			game.renderChars();
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
				
				var floorTileTransform = game.getTransformCSS(pos);

				$floorTile.css({
					width: game.tile * quad.width+'px',
					height: game.tile * quad.height+'px'
				}).css(floorTileTransform);
				
			});
			
		},
		
		/*
		*	RENDER FURNITURE
		* 	@args: room / parent room object
		*
		*	Renders 2D & 3D furniture objects and adds to collision matrix.		
		*/

		renderFurniture: function(room){
			
			var $room = (game.rooms[room.roomname].domNode);
			
			if(room.furniture){
				$.each(room.furniture, function(){
					
					var furn = this;
					
					$furn = $('<div class="furniture '+furn.objectClass+'" id="'+furn.objectName+'"/>').appendTo($room);
					
					if(furn.shape == 'cuboid'){
						var collisions = game.buildCuboid($furn, furn, room);
					};
					
					if(furn.moveable){
						game.moveables[furn.objectName] = {
							domObj: $furn[0],
							origin: furn.origin,
							collisions: collisions
						}
					};
					
					
				});
			};	
			
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
				domNode: game.$player[0],
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
							game.characters.player.dir = key;
							/*game.movements[key] = setInterval(function(){
								game.move(key);
					 		},1000/game.framerate);*/
					};
				},
				keyup: function(e){
					var key = checkKey(e.keyCode);
					
					if(keystates[key]){
						keystates[key] = false;
						//clearInterval(game.movements[key]);
					};
				}
			});
			
			game.updated = new Date().getTime();
			game.draw();
			game.play();
		},
		
		/*
		*	DRAW
		*
		*	Global front-end redraw function
		*/

		draw: function(time){

			var startFrame = new Date().getTime();
			
			// SET REFRESH RATE USING SETTIMEOUT AND REQUESTANIMATIONFRAME
			
			//setTimeout(function(){
				requestAnimationFrame(game.draw);

				// MOVE OBJECTS

				game.move();

				// REDRAW PLAYER

				var playerTransform = game.getTransformCSS(game.$player.data('translate'));

				game.$player.css(playerTransform);

				// REDRAW NPCs

				// REDRAW MOVEABLE OBJECTS
				
				$.each(game.moveables, function(key, value){
					var $moveable = $(value.domObj),
					 	moveableTransform = game.getTransformCSS($moveable.data('translate'));

					$moveable.css(moveableTransform);
				});

				// REDRAW CAMERA

				var cameraTransform = game.getTransformCSS(game.camera, {x: game.viewingAngle, y: 0, z: 0});

				game.$world.css(cameraTransform);

				// UPDATE HUD

				$('#RoomName').text(game.currentRoom.roomname);
				//$('#FPS').text(game.actualFPS+'fps');

				// GET FRAMERATE

				var endFrame = new Date().getTime(),
					frameDuration = endFrame - startFrame;
					game.actualFPS = (1000/frameDuration).toFixed(1);
					startFrame = endFrame;
			//},1000/game.framerate);

		},
		
		/*
		*	MOVE
		*	
		*	Calculates player and camera positions.
		*	Updates new positions if no collisions.
		*/
		
		move: function(){
			
			var newPlayerPos = {
					x: game.characters.player.x,
					y: game.characters.player.y
				},
				newCameraPos = {
					x: game.camera.x,
					y: game.camera.y
				},
				direction = game.characters.player.dir,
				controls = game.controls.states,
				now = new Date().getTime(),
				distance = (now - game.updated) / 500 * game.speed

			game.updated = now;
			
			if(controls.up && !controls.down){
				newPlayerPos.y = (game.characters.player.y + distance);
				newCameraPos.y = (game.camera.y + (distance * game.tile));
			} else if(controls.down && !controls.up){
				newPlayerPos.y = (game.characters.player.y - distance);
				newCameraPos.y = (game.camera.y - (distance * game.tile));
			};
			
			if(controls.left && !controls.right){
				newPlayerPos.x = (game.characters.player.x - distance);
				newCameraPos.x = (game.camera.x + (distance * game.tile));
			} else if(controls.right && !controls.left){
				newPlayerPos.x = (game.characters.player.x + distance);
				newCameraPos.x = (game.camera.x - (distance * game.tile));
			};
			
			// PASS POSITION TO COLLISION AND ROOM DETECTION
			
			var collision = game.detectCollision(newPlayerPos, direction, game.characters.player.bb);

			if(!collision.collided || collision.collided && collision.object.objectType == 'portal'){
				$.extend(game.characters.player,{
					x: newPlayerPos.x,
					y: newPlayerPos.y
				});
				game.camera = newCameraPos;
				game.currentRoom = game.detectRoom(game.characters.player);
				game.$player.attr('data-room',game.currentRoom.roomname);
				game.moveCharacter(game.characters.player);
			};
			if(collision.collided){
				
				// IF GOING THROUGH A DOOR
				
				if(collision.object.objectType == 'portal'){
					var $door = $(collision.object.domNode),
						doorTranslate = $door.data('translate'),
						doorRotate = $door.data('rotate');
						doorAngle = 180;
					
					if(!collision.object.open){
						doorAngle = 277;
						collision.object.open = true;
					} else {
						collision.object.open = false;
					}
				
					doorTransform = game.getTransformCSS(doorTranslate, {x: doorRotate.x, y: doorAngle, z: doorRotate.z});
						
					$door.css(doorTransform);
				};
				
				// IF MOVEABLE OBJECT - IN PROGRESS!
			
				if(collision.object.moveable){
					
					var $moveable = $('#'+collision.object.parent),
						moveable = game.moveables[collision.object.parent],
						moveableTranslate = $moveable.data('translate');
						
					if(direction == 'right' || direction == 'left'){
						
						// SHUNT OBJECT
						
						var increment = direction == 'right' ? distance : -distance;
						
						moveable.origin[0] = (moveable.origin[0] + increment);
						
						$.extend(moveableTranslate, {x: moveableTranslate.x + (increment * game.tile)});
						
						// UPDATE COLLISIONS
						
						for(var i = 0; i < moveable.collisions.length; i++){
							var indices = moveable.collisions[i],
								axis = indices[0],
								collideAt = indices[1],
								entryIndex = indices[2],
								data = game.collisionMatrix[axis][collideAt][indices[2]];
							
							if(axis == 'x'){ // filter to only x (as we are moving left/right)

								var newCollideAt = (collideAt + increment).toFixed(1) * 1;
								
								// update perpendicular min max values also;
						
								if(typeof game.collisionMatrix[axis][newCollideAt] == 'undefined'){
									game.collisionMatrix[axis][newCollideAt] = [];
								};
					
								game.collisionMatrix[axis][collideAt].splice(entryIndex,1); // <-- this is the problem (not deleting)!
								game.collisionMatrix[axis][newCollideAt].push(data);
								if(!game.collisionMatrix[axis][collideAt].length){
									delete game.collisionMatrix[axis][collideAt];
								};
							
								moveable.collisions[i][1] = newCollideAt;
								moveable.collisions[i][2] = game.collisionMatrix[axis][newCollideAt].length - 1;
							
							
							};
							
							// will need to update collisions with new indices;
						}
					};
					
					$moveable.data('translate', moveableTranslate);
					//console.info('done, heres the matrix');
					//console.info(game.collisionMatrix);
				};
			};
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
			
			$(character.domNode).data('translate',translate);
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
			var collision = {
					collided: false
				},
				collideAt = {};
	
			collideAt.x = direction == 'right' ? Math.ceil((position.x + bb.width) * 10) / 10 : Math.floor(position.x * 10 ) / 10, 
			collideAt.y = direction == 'up' ? Math.ceil((position.y + bb.height) * 10) / 10 : Math.floor(position.y * 10 ) / 10,
			offset = (direction == 'right' || direction == 'left') ? bb.height : bb.width;

			for(i = 0; i < 2; i++){
				var axis = i == 0 ? 'x' : 'y',
					perpAxis = i == 0 ? 'y' : 'x';
				if(typeof game.collisionMatrix[axis][collideAt[axis]] !== 'undefined'){
					
					for(var j = 0; j < game.collisionMatrix[axis][collideAt[axis]].length; j++){
						var collisionObject = game.collisionMatrix[axis][collideAt[axis]][j];
						
						if(
							// CHECK IF CHARACTER IS WITHIN PERPENDICULAR THRESHOLDS
							(collideAt[perpAxis] >= collisionObject[perpAxis+'Min'] && 
							collideAt[perpAxis] + offset <= collisionObject[perpAxis+'Max']) ||
							
							// CHECK IF CHARACTER ENVELOPS PERPENDICULAR THRESHOLDS
							
							(collideAt[perpAxis] <= collisionObject[perpAxis+'Min'] && 
							collideAt[perpAxis] + offset >= collisionObject[perpAxis+'Max']) ||
							
							// CHECK IF CHARACTER INTERSECTS EITHER PERPENDICULAR THRESHOLD
							
							(collideAt[perpAxis] <= collisionObject[perpAxis+'Min'] && 
							collideAt[perpAxis] + offset >= collisionObject[perpAxis+'Min']) ||
							
							(collideAt[perpAxis] <= collisionObject[perpAxis+'Max'] && 
							collideAt[perpAxis] + offset >= collisionObject[perpAxis+'Max'])
							
						){
							$.extend(collision, {
								collided: true,
								object: collisionObject
							});
							return collision;
						};
					}
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
			for(var i = 0; i < game.floorTiles.length; i++) {
				floorTile = game.floorTiles[i];
				if(
					game.characters.player.x >= floorTile.xMin &&
					game.characters.player.x <= floorTile.xMax &&
					game.characters.player.y >= floorTile.yMin &&
					game.characters.player.y <= floorTile.yMax
				){
					index = i;
				}
			}
			
			return {
				roomname: game.floorTiles[index].parentRoom,
				domNode: game.floorTiles[index].domNode
			};
		},
		
		/*
		*	GET TRANSFORM CSS
		*	@arg: translate / Object (xyz)
		*	@arg: rotate / Object (xyz)
		*	return style object for use with .css()
		*
		*	Converts translate and rotate values into prefixed and unprefixed transform string
		*/
		
		getTransformCSS: function(translate, rotate){
			rotate = rotate ? rotate : {x: 0, y: 0, z: 0};
			translate = translate.z ? translate : {x: translate.x, y: translate.y, z: 0};

			var styles = {};
			for(var i = 0; i < 2; i++){
				var prefix = i == 0 ? game.prefix : '';
				styles[prefix+'transform'] = 'translate3d('+translate.x+'px, '+translate.y+'px, '+translate.z+'px) rotateX('+rotate.x+'deg) rotateY('+rotate.y+'deg) rotateZ('+rotate.z+'deg)';
			};
			return styles;
		},
		
		/*
		*	PLAY
		*
		*	Manages HUD, interactions, scoring etc
		*/

		play: function(){
			
			//alert('Welcome to Barrelblocker! - Use WASD to move.');
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
				pixelY = (obj.origin[1] * game.tile);
				
			return {
				x: pixelX,
				y: -pixelY
			};
		},
		
		buildCuboid: function($cuboid, cuboid, room){
			var cuboidPos = game.positionInPixels(cuboid);
			$.extend(cuboidPos, {
				z: (cuboid.dimensions[2] * game.tile)
			});
		
			$cuboid.data('translate',cuboidPos);
			
			cuboidTransform = game.getTransformCSS(cuboidPos);

			$cuboid.css({
				width: (cuboid.dimensions[0] * game.tile)+'px',
				height: (cuboid.dimensions[1] * game.tile)+'px',
				background: cuboid.skin.top
			}).css(cuboidTransform);
			
			var verticalFaces = [
				{
					face: 'left',
					length: cuboid.dimensions[1],
					origin: [0,0],
					axis: 'y'
				},
				{
					face: 'back',
					length: cuboid.dimensions[0],
					origin: [0,cuboid.dimensions[1]],
					axis: 'x'
				},
				{
					face: 'right',
					length: -cuboid.dimensions[1],
					origin: [cuboid.dimensions[0],cuboid.dimensions[1]],
					axis: 'y',
					negative: true
				},
				{
					face: 'bottom',
					length: -cuboid.dimensions[0],
					origin: [cuboid.dimensions[0],0],
					axis: 'x',
					negative: true
				}
			];
			
			var collisions = [];
			
			$.each(verticalFaces, function(i){
				var face = this,
					$face = $('<div class="face '+face.axis+'-plane'+(face.negative ? ' negative' : '')+'"/>').appendTo($cuboid),
					width = face.negative ? -face.length : face.length,
					translate = {z: -cuboid.dimensions[2] * game.tile},
					rotate = {};
					
					if(face.axis == 'x'){
						translate.x = face.origin[0] * game.tile;
						translate.y = (verticalFaces[0].length - face.origin[1]) * game.tile;
						rotate = face.negative ? {x: 90, y: 180, z: 0} : {x: 90, y: 0, z: 0};
					} else {
						translate.x = face.origin[0] * game.tile;
						translate.y = (face.origin[1] + face.length) * game.tile;
						rotate = face.negative ? {x: 90, y: 90, z: 0} : {x: 90, y: 270, z: 0};
					};

					$face.data('translate',translate);
					$face.data('rotate',rotate);

					var faceTransform = game.getTransformCSS(translate, rotate);	

					$face.css({
						width: (width * game.tile)+'px',
						height: (cuboid.dimensions[2] * game.tile)+'px',
						marginBottom: ((cuboid.dimensions[1] - cuboid.dimensions[2]) * game.tile)+'px',
						background: cuboid.skin[face.face]
					}).css(faceTransform);
					
					// ADD TO COLLISION MATRIX
					
					collisions.push(game.pushCollision($face, face, cuboid, room, $cuboid[0]));
				
			});
			
			return collisions;

		},
		
		/*
		*	PUSH COLLISION
		*	@arg: $plane / jQuery object
		*	@arg: plane / levelData object
		*	@arg: parent / parent levelData object
		*	@arg: parent / grandparent levelData object
		*
		*	Pushes plane into collision matrix.
		*/
		
		pushCollision: function($plane, plane, parent, grandparent, parentDomNode){
			grandparent = grandparent ? grandparent : {origin: [0,0]};
			var absoluteOrigin = [
					plane.origin[0] + parent.origin[0] + grandparent.origin[0],
					plane.origin[1] + parent.origin[1] + grandparent.origin[1]
				],
				collideWith = plane.axis == 'x' ? 'y' : 'x',
				axisPos = plane.axis == 'x' ? 1 : 0,
				perpAxisPos = plane.axis == 'x' ? 0 : 1;
		
			if(typeof game.collisionMatrix[collideWith][absoluteOrigin[axisPos]] === 'undefined'){
				game.collisionMatrix[collideWith][absoluteOrigin[axisPos]] = [];
			};
		
			var entry = game.collisionMatrix[collideWith][absoluteOrigin[axisPos]],
				perpStart = absoluteOrigin[perpAxisPos],
				perpEnd = absoluteOrigin[perpAxisPos] + plane.length,
				collisionObject = {
					objectType: plane.portal ? 'portal' : 'plane',
					collide: plane.portal ? false : true,
					domNode: $plane[0],
					moveable: parent.moveable ? true : false,
					parent: parent.objectName
				};
			
				if(plane.portal){
					collisionObject.open = false;
				};
			
			collisionObject[plane.axis+'Min'] = perpStart > perpEnd ? perpEnd : perpStart;
			collisionObject[plane.axis+'Max'] = perpStart > perpEnd ? perpStart : perpEnd;
		
			var entryIndex = entry.push(collisionObject) -1;
			
			return [collideWith,absoluteOrigin[axisPos],entryIndex];
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
	$('#World').barrelBlocker('level.json');
});