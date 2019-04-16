let ctx = document.getElementById('elegy').getContext('2d');

let mapWidth = 33;
let mapHeight = 25;

let colormap = [];
let wallList = [];
let roomList = [];
let path = [];
let pathWallList = [];
let openWalls = [];

colormap = genColormap([1, 2, 2, 1, 0], true);
//colormap = genColormap([[0, 2, 2], [1, 1, 2], [1, 2, 1]], false);
//colormap = genColormap([[2, 1], [1, 0]], false);

let coordSkip = {};
for (let i = 0; i < mapHeight; i++) {
	for (let j = 0; j < mapWidth; j++) {
		if (i in coordSkip && coordSkip[i].includes(j)) {
			continue;
		}
		let color = colormap[i][j];
		if (color > 0) {
			let wall = findWall(i, j, color, []);
			for (let coord of wall) {
				if (!(coord[0] in coordSkip)) coordSkip[coord[0]] = [];
				coordSkip[coord[0]].push(coord[1]);
			}
			wallList.push(wall);
		} else roomList.push([i, j]);
	}
}

// Filter out the rooms on the borders, since these don't play
// nice with the 1-2-2-1-0 color scheme.
roomList = roomList.filter(x => x[0] != 0 && x[0] != mapHeight - 1 && x[1] != 0 && x[1] != mapWidth - 1);

// Select initial room and find its four walls.
let roomIndex = Math.floor(Math.random() * roomList.length);
path.push(roomIndex);
let room = roomList[roomIndex];
for (let i = 0; i < wallList.length; i++) {
	if (findAdjacent(wallList[i], room)) {
		pathWallList.push(i);
	}
}

while (pathWallList.length > 0) {
	let wallIndex = pathWallList[Math.floor(Math.random() * pathWallList.length)];
	let wall = wallList[wallIndex];
	let adjRooms = [];
	for (let i = 0; i < roomList.length; i++) {
		if (findAdjacent(wall, roomList[i])) {
			adjRooms.push(i);
		}
	}
	if (adjRooms.length == 2) {
		let unvisited = [];
		for (let room of adjRooms) {
			if (!path.includes(room)) unvisited.push(room);
		}
		if (unvisited.length == 1) {
			openWalls.push(wallIndex);
			path.push(unvisited[0]);
			for (let i = 0; i < wallList.length; i++) {
				if (findAdjacent(wallList[i], roomList[unvisited[0]])) {
					pathWallList.push(i);
				}
			}
		}
	}
	pathWallList = pathWallList.filter(x => x != wallIndex);
}

let tilemap = genTilemap();
//printTilemap(tilemap, mapWidth);
printTilemap(changeWallSize(tilemap), mapWidth * 2);

function changeWallSize(tilemap) {
	let newTilemap = [];
	for (let i = 0; i < tilemap.length; i++) {
		if (tilemap[i] == 1) {
			if (tilemap[i + 1] == 1) {
				newTilemap.push(1, 1);
			} else {
				newTilemap.push(1, 0);
			}
		} else {
			newTilemap.push(0, 0);
		}
		if (i % mapWidth == 0 && i > 0) {
			for (let j = 0; j < mapWidth * 2; j++) {
				let aboveIndex = newTilemap.length - (mapWidth * 2);
				if (newTilemap[aboveIndex] == 1) {
					newTilemap.push(1);
				} else {
					newTilemap.push(0);
				}
			}
		}
	}
	return newTilemap;
}

function printTilemap(tilemap, width) {
	let size = 12;
	for (let i = 0; i < tilemap.length; i++) {
		if (tilemap[i] == 0) {
			ctx.strokeStyle = 'black';
			ctx.strokeRect((i % width) * size, Math.floor(i / width) * size, size, size);
		} else {
			ctx.fillStyle = 'green';
			ctx.fillRect((i % width) * size, Math.floor(i / width) * size, size, size);
		}
	}
}

function genTilemap() {
	let tilemap = [];
	for (let i = 0; i < mapHeight * mapWidth; i++) {
		tilemap[i] = 1;
	}
	for (let index of openWalls) {
		for (let coords of wallList[index]) {
			tilemap[coords[0] * mapWidth + coords[1]] = 0;
		}
	}
	for (let room of roomList) {
		tilemap[room[0] * mapWidth + room[1]] = 0;
	}
	return tilemap;
}

function genColormap(pattern, lineReset) {
	let colormap = [];
	if (lineReset) {
		while (colormap.length < mapWidth * mapHeight) {
			for (let n of pattern) {
				colormap.push(n);
			}
		}
		let splitColormap = [];
		for (let i = 0; i < mapHeight; i++) {
			let start = i * mapWidth;
			splitColormap.push(colormap.slice(start, start + mapWidth));
		}
		return splitColormap;
	} else {
		for (let i = 0; i < mapHeight; i++) {
			colormap.push([]);
			for (let j = 0; j < mapWidth; j++) {
				for (let k = 0; k < pattern.length; k++) {
					if ((i - k) % pattern.length == 0) colormap[i].push(...pattern[k]);
				}
			}
			colormap[i] = colormap[i].slice(0, mapWidth);
		}
		return colormap;
	}
}

function findWall(i, j, c, wall) {
	for (let coord of wall) {
		if (i == coord[0] && j == coord[1]) {
			return;
		}
	}
	if (colormap[i][j] == c) {
		wall.push([i, j]);
		if (i + 1 < mapHeight) findWall(i + 1, j, c, wall);
		if (i - 1 > 0) findWall(i - 1, j, c, wall);
		if (j + 1 < mapWidth) findWall(i, j + 1, c, wall);
		if (j - 1 > 0) findWall(i, j - 1, c, wall);
	}
	return wall;
}

function findAdjacent(wall, room) {
	for (let coords of wall) {
		if ((coords[0] == room[0] - 1) && (coords[1] == room[1]) ||
			(coords[0] == room[0] + 1) && (coords[1] == room[1]) ||
			(coords[1] == room[1] - 1) && (coords[0] == room[0]) ||
			(coords[1] == room[1] + 1) && (coords[0] == room[0])) {
			return true;
		}
	}
}
