var GameBoard = (function() {
	var _round;
	var _previousRound;

	var _boardId = 'gameboard';
	var _boardStage;
	var _boardLayer;
	var _boardCenter;

	var _positions = [];
	var _enemies = [];

	var BOARD_SIZE = { w: 650, h: 550 },
		ENEMY_ICON_SIZE = 30,
		PROFILE_GRAVATAR_SIZE = 30,
		ATTACK_SPEED = 200, // ms
		MATH_DEG_TO_RAD = Math.PI / 180,
		POSITION_OFFSET = Math.sqrt(2 * Math.pow(PROFILE_GRAVATAR_SIZE, 2)) / 2,
		POSITION_WIDTH = Math.sqrt(2 * Math.pow(ENEMY_ICON_SIZE, 2)) + 2,
		PLAYER_GRAVATAR_DEFAULT = 'http://c.dryicons.com/images/icon_sets/simplistica/png/32x32/user.png',
		ENEMY_ICONS = {
			grunt: 'http://www.southeastarrow.com/images/icons/blue-left-arrow.png',
			swarmer: 'http://www.southeastarrow.com/images/icons/blue-left-arrow.png',
			trooper: 'http://www.southeastarrow.com/images/icons/blue-left-arrow.png',
			'speed-demon': 'http://www.southeastarrow.com/images/icons/blue-left-arrow.png',
			flyer: 'http://www.southeastarrow.com/images/icons/blue-left-arrow.png',
			cluster: 'http://www.southeastarrow.com/images/icons/blue-left-arrow.png',
			bruiser: 'http://www.southeastarrow.com/images/icons/blue-left-arrow.png'
		};

	function Position(num, center) {
		this.num = num;
		this.center = center;
		this.spots = [];

		this.radius = POSITION_OFFSET + this.num * POSITION_WIDTH;
		this.maxOfSpots = Math.floor((2 * Math.PI * (this.radius + POSITION_WIDTH / 2)) / (ENEMY_ICON_SIZE * 1.5));

		this.renderMark();
	};

	Position.prototype.getMaxSpots = function() {
		return this.maxOfSpots;
	};

	Position.prototype.getFreeSpot = function() {
		for (var i = 0; i < this.getMaxSpots(); i++) {
			if (typeof this.spots[i] === 'undefined' || this.spots[i] === false) {
				return this.spots[i] = i;
			}
		}
		return -1;
	};

	Position.prototype.renderMark = function() {
		this.mark = new Kinetic.Circle({
			x: this.center.x,
			y: this.center.y,
			radius: this.radius,
			stroke: '#555',
			strokeWidth: 1,
			dashArray: [10, 10]
		});
		_boardLayer.add(this.mark);
	};

	Position.prototype.getRadius = function() {
		return this.radius;
	};

	Position.prototype.setSpot = function(spot, enemy) {
		if (spot >= this.maxOfSpots) {
			return;
		}
		this.spots[spot] = enemy;
	};

	Position.prototype.reset = function() {
		this.spots = [];
	};

	var renderMobs = function(mobs) {
		_.each(mobs, function(mob) {
			if (typeof _enemies[mob.id] !== 'undefined') {
				// Do not render if the enemy is on the board
				return;
			}

			var pos = _positions[mob.position];
			var posSpot = pos.getFreeSpot();
			if (posSpot < 0) {
				// No spot available
				return;
			}

			// Calculate the position on board
			var spotAngle = 360 / pos.getMaxSpots();
			var spotRad = spotAngle * MATH_DEG_TO_RAD;
			var marginSpace = (POSITION_WIDTH - ENEMY_ICON_SIZE) / 2;
			var radius = pos.getRadius() + marginSpace;
			var startAngle = Math.asin((ENEMY_ICON_SIZE / 2) / radius);
			var enemyRad = spotRad * posSpot - startAngle;

			var posX = radius * Math.cos(enemyRad);
			var posY = radius * Math.sin(enemyRad);

			var imageObj = new Image();
			imageObj.onload = function() {
				_enemies[mob.id] = new Kinetic.Image({
					x: _boardCenter.x + posX,
					y: _boardCenter.y + posY,
					image: imageObj,
					rotation: enemyRad,
					width: ENEMY_ICON_SIZE,
					height: ENEMY_ICON_SIZE
				});
				pos.setSpot(posSpot, _enemies[mob.id]);
				_enemies[mob.id].boardPosition = posSpot;
				_boardLayer.add(_enemies[mob.id]);
				_boardStage.add(_boardLayer);
			};
			imageObj.src = ENEMY_ICONS[mob.type];
		});
	};

	function GameBoard(roundInfo) {
		_previousRound = _round;
		_round = roundInfo;
		renderMobs(_round.getMobs());
	}

	GameBoard.prototype.displayAttack = function() {
		_.each(_round.getMyAttacks(), function(attack) {
			var enemyId = attack.enemyId,
				enemy = _enemies[enemyId],
				isEnemyDead = !_.find(_round.getMobs(), function(mob) { return mob.id === enemyId; });

			var attackLine = new Kinetic.Line({
				x: _boardCenter.x,
				y: _boardCenter.y,
				points: [0, 0, 10, 0],
				stroke: 'red',
				rotation: enemy.getRotation()
			});
			_boardLayer.add(attackLine);
			var incX = enemy.getX() - attackLine.getX(),
				incY = enemy.getY() - attackLine.getY();
			var anim = new Kinetic.Animation(function(frame) {
				if (frame.time >= ATTACK_SPEED) {
					this.stop();
					attackLine.remove();

					if (isEnemyDead) {
						_positions[attack.position].setSpot(enemy.boardPosition, false);
						enemy.remove();
						delete _enemies[enemyId];
					}
					return;
				}
				var rate = frame.time / ATTACK_SPEED;
				attackLine.setX(_boardCenter.x + incX * rate);
				attackLine.setY(_boardCenter.y + incY * rate);
			}, _boardLayer);
			anim.start();
		});
	};

	GameBoard.prototype.displayEnemyAttack = function() {
	};

	GameBoard.renderUser = function() {
		var imageObj = new Image();
		imageObj.onload = function() {
			var gravatar = new Kinetic.Image({
				x: _boardCenter.x - (PROFILE_GRAVATAR_SIZE / 2),
				y: _boardCenter.y - (PROFILE_GRAVATAR_SIZE / 2),
				image: imageObj,
				width: PROFILE_GRAVATAR_SIZE,
				height: PROFILE_GRAVATAR_SIZE
			});
			_boardLayer.add(gravatar);
			_boardStage.add(_boardLayer);
		};
		imageObj.src = (typeof twitter !== 'undefined' && twitter.profile_image_url_https) || PLAYER_GRAVATAR_DEFAULT;
	};

	GameBoard.renderPositionMarks = function() {
		_.each([0, 1, 2, 3, 4, 5], function(pos) {
			_positions[pos] = new Position(pos, _boardCenter);
		});
	};

	GameBoard.renderTemplate = function() {
		GameBoard.renderUser();
		GameBoard.renderPositionMarks();
	};

	GameBoard.boardSetup = function() {
		_boardStage = new Kinetic.Stage({
			container: _boardId,
			width: BOARD_SIZE.w,
			height: BOARD_SIZE.h
		});
		_boardCenter = {
			x: _boardStage.getWidth() / 2,
			y: _boardStage.getHeight() / 2
		};
		_boardLayer = new Kinetic.Layer();

		GameBoard.renderTemplate();
	};

	GameBoard.cleanup = function() {
		_.each(_enemies, function(enemy) {
			enemy.remove();
		});
		_enemies = [];

		_.each(_positions, function(position) {
			position.reset();
		});
	};

	return GameBoard;

}());