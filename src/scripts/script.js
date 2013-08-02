/* --- BARRELBLOCKER ENGINE --- */

(function($){

	var game = {
		prefix: false,
		$world: null,
		$player: null,
		levelData: null,
		tile: 100,
		speed: 2.5,
		score: 0,
		cameraSpeed: null,
		framerate: 60,
		actualFPS: null,
		world: {
			width: null,
			height: null
		},
		rooms: {},
		camera: {
			x: null,
			y: null,
			z: null,
			rotation: {
				x: 75,
				y: 0,
				z: 0
			},
			perspective: 2000
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
				},
				images: {
					body: 'images/scott.svg',
					foot: 'images/foot.svg'
				}
			},
			npcs: []
		},
		moveables: {},
		shunt: {
			shunting: false,
			dir: null,
			shuntStart: [0,0],
			shuntEnd: [0,0]
		},
		currentRoom: null,
		collisionObjects: {},
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
					$.extend(game.camera, {
						x: game.tile * ((game.levelData.world.width / 2) - game.characters.player.x),
						y: -game.tile * ((game.levelData.world.length / 2) - game.characters.player.y),
						z: 0
					});
					
					var cameraTransform = game.getTransformCSS(game.camera, game.camera.rotation);
					
					game.$world.css({
						width: game.world.width+'px',
						height: game.world.length+'px',
						margin: (game.world.length / -2)+'px 0 0 '+(game.world.width / -2)+'px'
					}).css(cameraTransform);

					$('body').css({
						perspective: game.camera.perspective+'px'
					});

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
					roomClass = room.roomClass == 'pit' ? ' pit' : '',
					$room = $('<div class="room'+roomClass+'" id="'+room.roomname+'"/>').appendTo(game.$world),
					roomPos = {
						x: game.tile * room.origin[0],
						y: -(game.tile * room.origin[1]),
						z: room.roomClass == 'pit' ? 1 : 0
					};
					
				// POSITION ROOM
					
				var roomTransform = game.getTransformCSS(roomPos);
				$room.css(roomTransform);
				
				// BUILD ROOM OBJECT
				
				game.rooms[room.roomname] = {
					domNode: $room[0],
					floor: [],
					absOrigin: room.origin,
					pit: room.roomClass == 'pit' ? true : false
				};
				
				// BUILD COLLISION OBJECT 
				
				game.collisionObjects[room.roomname] = {
					domNode: $room[0],
					absOrigin: room.origin,
					objectType: 'room',
					objectName: room.roomname, 
					moveable: false,
					left: [],
					right: [],
					up: [],
					down: []
				};
				
				// FOR EACH WALL
				
				$.each(room.walls,function(){
					var wall = this,
						negative = -wall.length > 0 ? true : false,
						className = (negative ? ' negative' : '') + (wall.backfaceVisible ? ' backface' : '') + (wall.portal ? ' portal' : ''),
						pxLength = negative ? -wall.length : wall.length,
						translate = {},
						rotate = {};

					if(wall.className) {
						className += ' '+wall.className;
					}	

					var $wall = $('<div class="wall '+wall.axis+'-plane'+className+'" style="background: '+wall.background+'"/>').appendTo($room);

					if(wall.isWindow) {
						$wall.css({
							'background-image': wall.background,
							'background': 'none'
						}).addClass('window');
					}
						
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

					if(wall.renderOffset) {
						$.each(wall.renderOffset, function(key, value){
							translate[key] += value;
						});
					}
					
					$wall.data('translate',translate);
					$wall.data('rotate',rotate);
					
					var wallTransform = game.getTransformCSS(translate, rotate);	
				
					$wall.css(wallTransform);

					if(wall.contents) {
						$.each(wall.contents, function() {
							var decoration = this;

							$deco = $('<div class="object '+decoration.objectClass+'" id="'+decoration.objectName+'"/>').appendTo($wall);

							var styles = {
								'width': game.tile * decoration.width,
								'bottom': game.tile * decoration.origin[1]
							};

							if(negative) {
								styles['right'] = game.tile * decoration.origin[0];
							} else {
								styles['left'] = game.tile * decoration.origin[0];
							}

							$deco.css(styles);
							if(decoration.img) {
								$deco.append('<img src="'+decoration.img+'">');
							}
						});
					}
					
					// ADD TO COLLISION MATRIX
					
					game.pushToCollisionObject(wall, room, true);
					
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
					
				pos.z = -1;
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
						game.buildCuboid($furn, furn, room);
					};
					
					if(furn.moveable){
						game.moveables[furn.objectName] = {
							domObj: $furn[0],
							origin: furn.origin,
							bb: {
								width: furn.dimensions[0],
								height: furn.dimensions[1]
							},
							height: furn.dimensions[2],
							value: furn.value
						}
					};

					if(furn.contents) {
						$.each(furn.contents, function() {
							var obj = this;

							$obj = $('<div class="object '+obj.objectClass+'" id="'+obj.objectName+'"/>').appendTo($furn);
							$obj.css({
								'width': game.tile * obj.width,
								'left': game.tile * obj.origin[0],
								'bottom': game.tile * obj.origin[1]
							})
							$obj.append('<img src="'+obj.img+'">');
						});
					}
					
					
				});
			};	
			
		},
		
		/*
		*	RENDER CHARACTERS
		*
		*	Renders player and all NPCs.
		*/

		renderChars: function(){

			// RENDER AND PLACE PLAYER
			
			game.$player = $('<div class="char player"><div class="avatar"><div class="face y-plane"></div><div class="face x-plane"><span class="eyes"></span></div><div class="face y-plane negative"></div><div class="face x-plane negative"></div></div></div>').appendTo(game.$world);

			var playerSkin = {
				top: '#332115',
				left: '#557ffb',
				back: '#557ffb',
				right: '#557ffb',
				bottom: '#f6b597'
			}

			game.$player.find('.avatar').css('background', playerSkin.top)
				.find('.x-plane:not(.negative)').css('background', playerSkin.bottom)
				.siblings('.x-plane.negative').css('background', playerSkin.back)
				.siblings('.y-plane:not(.negative)').css('background', playerSkin.left)
				.siblings('.y-plane.negative').css('background', playerSkin.right);

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

			// RENDER AND PLACE NPCS

			game.$npcs = [];
			if(game.levelData.npcs) {
				$.each(game.levelData.npcs, function(){
					var $npc = $('<div class="char '+this.type+'"><div class="avatar"/></div>').appendTo(game.$world),
						npc = {
							type: this.type,
							dir: 'down',
							domNode: $npc[0],
							x: this.startPos[0],
							y: this.startPos[1],
							moves: this.moves,
							bb: game.characters.player.bb,
							updated: new Date().getTime()
						}

					$npc.css({
						width: (npc.bb.width * game.tile)+'px',
						height: (npc.bb.height * game.tile)+'px'
					});

					game.$npcs.push($npc);
					game.characters.npcs.push(npc);

					game.moveCharacter(npc);
				});
			}
			
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

							game.$player.removeClass('left-to-up up-to-left');

							if(key == 'up' && game.$player.is('.left')) {
								game.$player.addClass('left-to-up');
							} else if((key == 'left' && game.$player.is('.up'))) {
								game.$player.addClass('up-to-left');
							}

							game.$player.removeClass('up down left right').addClass(key);
							game.characters.player.dir = key;
					};
				},
				keyup: function(e){
					var key = checkKey(e.keyCode);
					
					if(keystates[key]){
						keystates[key] = false;
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
				var playerRotation = {
					x: 0,
					y: 0,
					z: 0
				}

				game.$player.css(playerTransform);

				// REDRAW NPCs

				for(var i = 0; i < game.$npcs.length; i++) {
					var $npc = game.$npcs[i];
					$npc.css(game.getTransformCSS($npc.data('translate')));
				}

				// REDRAW MOVEABLE OBJECTS
				
				$.each(game.moveables, function(key, value){
					var $moveable = $(value.domObj),
					 	moveableTransform = game.getTransformCSS($moveable.data('translate'));

					$moveable.css(moveableTransform);
				});

				// REDRAW CAMERA

				var cameraTransform = game.getTransformCSS(game.camera, game.camera.rotation);

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
					y: game.camera.y,
					z: game.camera.z
				},
				direction = game.characters.player.dir,
				controls = game.controls.states,
				now = new Date().getTime(),
				distance = (now - game.updated) / 500 * game.speed,
				distanceMoved = {},
				dirX,
				dirY,
				countKeys = 0;
				
				game.updated = now;
			
			// COUNT KEYS DOWN	
				
			if(controls.down)countKeys++;
			if(controls.up)countKeys++;
			if(controls.left)countKeys++;
			if(controls.right)countKeys++;	
			
			if(countKeys > 1){
				controls = {
					left: false,
					right: false,
					up: false,
					down: false
				};
				controls[direction] = true;
			};	
			
			// DROP MOVEABLE OBJECT IF SHUNTING AND DIRECTION REVERSES

			if(game.shunt.shunting){
				if(game.shunt.dir != direction){
					game.shunt.shunting = false;
					game.shunt.shuntStop = [newPlayerPos.x, newPlayerPos.y];
					game.dropMoveable(game.shunt.objectName, game.shunt.dir);
					return false;
				};
			};	
			
			if(controls.up && !controls.down){
				dirY = 'up';
				newPlayerPos.y = (game.characters.player.y + distance);
				newCameraPos.y += distance * (game.tile / 2);
				newCameraPos.z += distance * (game.tile / 2);
			} else if(controls.down && !controls.up){
				dirY = 'down';
				newPlayerPos.y = (game.characters.player.y - distance);
				newCameraPos.y -= distance * (game.tile / 2);
				newCameraPos.z -= distance * (game.tile / 2);
			};
			
			if(controls.left && !controls.right){
				dirX = 'left';
				newPlayerPos.x = (game.characters.player.x - distance);
				newCameraPos.x += distance * (game.tile / 2);
			} else if(controls.right && !controls.left){
				dirX = 'right'
				newPlayerPos.x = (game.characters.player.x + distance);
				newCameraPos.x -= distance * (game.tile / 2);
			};
			
			distanceMoved = {
				x: newPlayerPos.x - game.characters.player.x,
				y: newPlayerPos.y - game.characters.player.y
			};
			
			// PASS POSITION TO COLLISION AND ROOM DETECTION
			
			var collision = {
				collided: false
			};
			
			if(dirX || dirY){
				game.$player.addClass('walking');
				
				var collisionPos = {
					x: newPlayerPos.x,
					y: newPlayerPos.y
				};
				
				if(game.shunt.shunting){
					if(game.shunt.dir == 'right' || game.shunt.dir == 'left'){
						collisionPos.x = 	game.shunt.dir == 'right' ? collisionPos.x + game.moveables[game.shunt.objectName].bb.width : 
											collisionPos.x - game.moveables[game.shunt.objectName].bb.width;
					} else {
						collisionPos.y = 	game.shunt.dir == 'up' ? collisionPos.y + game.moveables[game.shunt.objectName].bb.height : 
											collisionPos.y - game.moveables[game.shunt.objectName].bb.height;
					};
				};
				
				collision = game.detectCollision(collisionPos, dirX, game.characters.player.bb);
				if(!collision.collided){
					collision = game.detectCollision(collisionPos, dirY, game.characters.player.bb);
				}
				console.info(collision)
			
			} else {
				game.$player.removeClass('walking');
			};
			
			function moveAlong(){
				$.extend(game.characters.player,{
					x: newPlayerPos.x,
					y: newPlayerPos.y
				});
				$.extend(game.camera, newCameraPos);
				game.currentRoom = game.detectRoom(game.characters.player);
				game.$player.attr('data-room',game.currentRoom.roomname);
				game.moveCharacter(game.characters.player);
				
				if(game.currentRoom.pit){
					// GAME OVER!!
				}
			};

			if(!collision.collided){
				moveAlong();
			};
			
			// IF GOING THROUGH A DOOR
			
			if(collision.collided && collision.objectType == 'portal'){
				
				moveAlong();
				
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
					};
				
					doorTransform = game.getTransformCSS(doorTranslate, {x: doorRotate.x, y: doorAngle, z: doorRotate.z});
						
					$door.css(doorTransform);
				};
			};
				
			// IF MOVEABLE OBJECT 
			
			if(collision.collided && collision.moveable){
				
				var collisionObject = game.collisionObjects[collision.collidedWith],
					$moveable = $(collisionObject.domNode),
					moveableTranslate = $moveable.data('translate');
				
				if(!game.shunt.shunting){
				
					game.shunt = {
						shunting: true,
						objectName: collision.collidedWith,
						dir: direction,
						shuntStart: [newPlayerPos.x, newPlayerPos.y],
						collisionData: game.collisionObjects[collision.collidedWith]
					};
					
					// REMOVE OBJECT FROM COLLISIONOBJECTS
					
					delete game.collisionObjects[collision.collidedWith];
					
					// CALCULATE TRANSLATE VALUES FOR WITHIN CHARACTER
					
					var newTranslate = {},
						offset;
					
					if(direction == 'left' || direction == 'right'){
						offset = game.shunt.collisionData.absOrigin[1] - game.characters.player.y;
						newTranslate = {
							x: direction == 'right' ? game.characters.player.bb.width * game.tile : -game.moveables[collision.collidedWith].bb.width * game.tile,
							y: -offset * game.tile,
							z: game.moveables[collision.collidedWith].height * game.tile
						};
					} else {
						offset = game.shunt.collisionData.absOrigin[0] - game.characters.player.x;
						newTranslate = {
							x: offset * game.tile,
							y: direction == 'up' ? -game.characters.player.bb.height * game.tile : game.moveables[collision.collidedWith].bb.height * game.tile,
							z: game.moveables[collision.collidedWith].height * game.tile
						}
					}
						
					$moveable.data('translate',newTranslate);
					
					// APPEND OBJECT TO CHARACTER
					
				
					
					game.$player.append($moveable);
				};
						
			};
					
			//game.moveNPCs();
		},
		
		dropMoveable: function(objectName, shuntDir){

			var $moveable = $('#'+objectName),
				$room = $(game.currentRoom.domNode),
				moveable = game.moveables[objectName],
				moveableTranslate = $moveable.data('translate');
				
			// APPEND OBJECT TO ROOM 
				
			$room.append($moveable);
			
			// RE-ADD TO COLLISION OBJECT
			
			game.collisionObjects[objectName] = game.shunt.collisionData;
				
			// CALCULATE DISTANCE MOVED	
				
			var collisionObject = game.collisionObjects[objectName],
				distanceShunted = {
					x: shuntDir == 'left' ? Math.floor((game.shunt.shuntStop[0] - game.shunt.shuntStart[0]) * 10) / 10 : Math.ceil((game.shunt.shuntStop[0] - game.shunt.shuntStart[0]) * 10) / 10,
					y: shuntDir == 'down' ? Math.floor((game.shunt.shuntStop[1] - game.shunt.shuntStart[1]) * 10) / 10 : Math.ceil((game.shunt.shuntStop[1] - game.shunt.shuntStart[1]) * 10) / 10,
				};
			
			// UPDATE COLLISION OBJECT
		
			collisionObject.absOrigin = [
				(collisionObject.absOrigin[0] + distanceShunted.x).toFixed(1) * 1,
				(collisionObject.absOrigin[1] + distanceShunted.y).toFixed(1) * 1
			];
			
			// CHECK IF IN PIT
			
			moveableRoom = game.detectRoom({
				x: collisionObject.absOrigin[0],
				y: collisionObject.absOrigin[1]
			});
			
			if(moveableRoom.pit){
				game.score += moveable.value;
				$moveable.remove();
				delete game.moveables[objectName];
				delete game.collisionObjects[objectName];
				console.info(game.score)
				return;
			};
			
			// UPDATE COLLISION DATA
			
			for(i = 0; i < 4; i++){
				var collideDir = 'left'
					axis = (game.shunt.dir == 'right' || game.shunt.dir == 'left') ? 'x' : 'y';
				
				switch(i){
					case 1:
						collideDir = 'right';
						break;
					case 2:
						collideDir = 'up';
						break;
					case 3:
						collideDir = 'down';
						break;
				};
				
				for(j = 0; j < collisionObject[collideDir].length; j++){
					var plane = collisionObject[collideDir][j],
						key = axis;
					
					for(k = 0; k < 3; k++){
						switch(k){
							case 1:
								key = axis+'Min';
								break;
							case 2:
								key = axis+'Max';
								break;
						};

						if(typeof plane[key] !== 'undefined'){
							plane[key] = (plane[key] + distanceShunted[axis]).toFixed(1) * 1;
						};
					}
					
				}
			};
			
			// SNAP TO GRID
			
			var roomOffset = game.rooms[game.currentRoom.roomname].absOrigin,
				newGridPos = {
					x: (collisionObject.absOrigin[0] - roomOffset[0]).toFixed(1) * 1,
					y: (collisionObject.absOrigin[1] - roomOffset[1]).toFixed(1) * 1,
				},
				newTranslate = {
					x: (newGridPos.x * game.tile).toFixed(1) * 1,
					y: (-newGridPos.y * game.tile).toFixed(1) * 1
				};
	
			$.extend(moveableTranslate, newTranslate);
		
			$moveable.data('translate', moveableTranslate).removeClass('shunted');
			
			// UPDATE MOVEABLE ORIGIN
			
			moveable.origin = [newGridPos.x,newGridPos.y];
		
		
		},

		/*
		*	MOVE NPCS
		*	
		*	Calculates positions for all NPCs.
		*/
		
		moveNPCs: function(){
			var directions = ['up', 'down', 'left', 'right'];
			for(var i = 0; i < game.characters.npcs.length; i++) {
				var npc = game.characters.npcs[i];

				if(npc.moves && npc.moves.length <= 1) {
					for(var i = 0; i < 5; i++) {
						npc.moves.push({
							dir: directions[Math.round(Math.random() * 3)],
							time: Math.round(Math.random() * 5) * 200
						});
					}
				}

				if(npc.moves.length) {
					var newPos = {
							x: npc.x,
							y: npc.y
						},
						direction = npc.moves[0].dir,
						now = new Date().getTime(),
						elapsed = (now - npc.updated),
						distance = elapsed / 500 * game.speed,
						dirX,
						dirY;

					npc.updated = now;
					npc.moves[0].time -= elapsed;


					if(direction == 'up'){
						newPos.y += distance;
					} else if(direction == 'down'){
						newPos.y -= distance;
					};

					if(direction == 'left'){
						newPos.x -= distance;
					} else if(direction == 'right'){
						newPos.x += distance;
					};

					var collision = game.detectCollision(newPos, direction, npc.bb);
				
					function moveAlong(){
						$.extend(npc,newPos);
						game.moveCharacter(npc);
					};

					if(!collision.collided){
						moveAlong();
					} else {
						npc.moves.shift();
					}

					if(npc.moves[0] && npc.moves[0].time <= 0) {
						npc.moves.shift();
					}
				}
			}
		},
		
		/*
		*	MOVE CHARACTER
		*	@arg: player / Player object
		*
		*	Updates translation values for character;
		*/
		
		moveCharacter: function(character){
			var translate = game.positionInPixels({
				width: game.characters.player.bb.width,
				height: game.characters.player.bb.height,
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
		*	Checks player position against all objects in collision matrix
		*/
		
		detectCollision: function(position, direction, bb){
		
			var collision = {
					collided: false
				},
				collideAt = {},
				axis = (direction == 'right' || direction == 'left') ? 'x' : 'y',
				perpAxis = axis == 'x' ? 'y' : 'x';
				
			if(typeof direction === 'undefined'){
				return collision;
			};
	
			collideAt.x = direction == 'right' ? Math.floor((position.x + bb.width) * 10) / 10 : Math.ceil(position.x * 10 ) / 10, 
			collideAt.y = direction == 'up' ? Math.floor((position.y + bb.height) * 10) / 10 : Math.ceil(position.y * 10 ) / 10,
			offset = (direction == 'right' || direction == 'left') ? bb.height : bb.width;
	
			$.each(game.collisionObjects, function(){
				var collisionObject = this;
				
				for(i = 0; i < collisionObject[direction].length; i++){
					var collisionPlane = collisionObject[direction][i],
						errorMargin = 0.1;
					
					if(
						 
						collideAt[axis] == collisionPlane[axis] &&
						
						(
							// CHECK IF CHARACTER IS WITHIN PERPENDICULAR THRESHOLDS
							(collideAt[perpAxis] >= collisionPlane[perpAxis+'Min'] && 
							collideAt[perpAxis] + offset <= collisionPlane[perpAxis+'Max']) ||
						
							// CHECK IF CHARACTER ENVELOPS PERPENDICULAR THRESHOLDS
						
							(collideAt[perpAxis] <= collisionPlane[perpAxis+'Min'] && 
							collideAt[perpAxis] + offset >= collisionPlane[perpAxis+'Max']) ||
						
							// CHECK IF CHARACTER INTERSECTS EITHER PERPENDICULAR THRESHOLD
						
							(collisionPlane[perpAxis+'Min'] > collideAt[perpAxis] && 
							collisionPlane[perpAxis+'Min'] < collideAt[perpAxis] + offset) ||
						
							(collisionPlane[perpAxis+'Max'] > collideAt[perpAxis] && 
							collisionPlane[perpAxis+'Max'] < collideAt[perpAxis] + offset)
						)
						
					){
						
						$.extend(collision, {
							collided: true,
							collidedWith: collisionObject.objectName,
							planeData: collisionPlane,
							moveable: collisionObject.moveable,
							objectType: collisionObject.objectType,
							collidedAt: collideAt,
							collideDir: direction
						});
						return collision;
					};
				};
				return collision;
			});
			
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
					position.x >= floorTile.xMin &&
					position.x <= floorTile.xMax &&
					position.y >= floorTile.yMin &&
					position.y <= floorTile.yMax
				){
					index = i;
				}
			}
			
			return {
				roomname: game.floorTiles[index].parentRoom,
				domNode: game.floorTiles[index].parentdomNode,
				pit: game.rooms[game.floorTiles[index].parentRoom].pit
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
				styles[prefix+'transform'] = 'translate3d('+translate.x+'px, '+translate.y+'px, '+translate.z+'px) rotateX('+(rotate.x)+'deg) rotateY('+rotate.y+'deg) rotateZ('+rotate.z+'deg)';
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
			
			// BUILD COLLISION OBJECT
			
			game.collisionObjects[cuboid.objectName] = {
				domNode: $cuboid[0],
				absOrigin: [cuboid.origin[0] + room.origin[0], cuboid.origin[1] + room.origin[1]],
				objectType: 'cuboid',
				objectName: cuboid.objectName, 
				moveable: cuboid.moveable,
				left: [],
				right: [],
				up: [],
				down: []
			};
			
			// FOR EACH FACE
			
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
					
					game.pushToCollisionObject(face, cuboid, false);		
				
			});

		},
		
		/*
		*	PUSH TO COLLISION OBJECT
		*/
		
		pushToCollisionObject: function(plane, parent, isRoom){
			var parentName = parent.roomname || parent.objectName,
				collisionObject = game.collisionObjects[parentName],
				absoluteOrigin = [
					plane.origin[0] + collisionObject.absOrigin[0],
					plane.origin[1] + collisionObject.absOrigin[1]
				],
				isNegative = plane.length < 0 ? true : false,
				axis = plane.axis,
				perpAxis = axis == 'x' ? 'y' : 'x',
				axisPos = axis == 'x' ? 1 : 0,
				perpAxisPos = axis == 'x' ? 0 : 1,
				planeStart = absoluteOrigin[perpAxisPos],
				planeEnd = absoluteOrigin[perpAxisPos] + plane.length,
				collideDir;
				
			if(axis == 'y'){
				if(isRoom){
					collideDir = isNegative ? 'right' : 'left';
				} else {
					collideDir = isNegative ? 'left' : 'right';
				};
			} else {
				if(isRoom){
					collideDir = isNegative ? 'down' : 'up';
				} else {
					collideDir = isNegative ? 'up' : 'down';
				};
			};
			
			var collisionData = {
					portal: plane.portal ? true : false
				};
				
			collisionData[perpAxis] = absoluteOrigin[axisPos];
			collisionData[axis+'Min'] = planeStart > planeEnd ? planeEnd : planeStart;
			collisionData[axis+'Max'] = planeStart > planeEnd ? planeStart : planeEnd;
			
			game.collisionObjects[parentName][collideDir].push(collisionData);
			
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