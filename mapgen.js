// Map Generator - a tilemap generator using Prim's algorithm for maze
// generation.
//
// This program implements Prim's algorithm to produce a maze-like
// tilemap suitable for use in tile-based games. Using a color pattern
// grid, a series of functions executed by initTilemap will randomly
// carve out a maze. Different color patterns will produce different
// kinds of mazes. Another function, changeWallSize, increases the
// width of the walls and pathways to make them more suitable for the
// look and playability of a game.  Finally, drawTilemap will draw the
// tilemap using the canvas API.

// Objects for the canvas API.
const canvas = document.getElementById('elegy');
const ctx = canvas.getContext('2d');

// The construction of the tilemap maze begins with a colormap, which
// is really just a pattern of numbers that could be represented as
// colors. Prim's algorithm uses this pattern as a starting point for
// building the eventual maze pattern.
class Colormap {
	constructor(pattern, width, height, lineReset) {
		this.map = this.genColormap(pattern, width, height, lineReset);
		this.width = width;
		this.height = height;
	}
	// Generate a colormap with a given pattern and dimensions.  The
	// pattern takes the form of an array of numbers that gets
	// repeated throughout the map, or an array of arrays if the
	// pattern changes from line to line (the lines cycle through the
	// arrays). The lineReset boolean indicates whether to start the
	// pattern over on a new line or just continue where it left off
	// at the end of the previous line.
	genColormap(pattern, width, height, lineReset) {
		let colormap = [];
		// If we are not supposed to reset the pattern for each new
		// line:
		if (!lineReset) {
			// Repeatedly push the pattern onto the colormap array
			// until it's full.
			while (colormap.length < width * height) {
				for (let n of pattern) {
					colormap.push(n);
				}
			}
			// Split the flat array into a series of rows.
			let splitColormap = [];
			for (let i = 0; i < height; i++) {
				let start = i * width;
				splitColormap.push(colormap.slice(start, start + width));
			}
			return splitColormap;
			// If we are not supposed to reset the pattern.
		} else {
			// For every row, push an empty array onto the map.
			for (let i = 0; i < height; i++) {
				colormap.push([]);
				// Push the destructured elements of the pattern onto
				// the row.
				for (let j = 0; j < width; j++) {
					for (let k = 0; k < pattern.length; k++) {
						if ((i - k) % pattern.length == 0) colormap[i].push(...pattern[k]);
					}
				}
				// Cut off the elements that exceed the row's required
				// width.
				colormap[i] = colormap[i].slice(0, width);
			}
			return colormap;
		}
	}
}

// Tilemap data, including the map itself and its width, plus methods
// to convert between the array index and the row/column structure.
// The tilemap itself is an array of 1s and 0s, 1 being a wall and 0
// an empty space, representing a two-dimensional maze.
class Tilemap {
	constructor(colormap, wallList, openWalls, roomList) {
		this.map = this.genTilemap(colormap, wallList, openWalls, roomList);
		this.width = colormap.width;
	}

	// Take an array index and return the corresponding row and
	// column.
	indexToRowCol(i) {
		// The row is the index divided by the width and the column is
		// the remainder.
		return [Math.floor(i / this.width), i % this.width];
	}

	// Makes a tilemap out of the generated colormap, total lists of
	// walls and rooms, and the list of opened walls.
	genTilemap(colormap, wallList, openWalls, roomList) {
		let tilemap = [];
		// Initialize every tile as a wall.
		for (let i = 0; i < colormap.height * colormap.width; i++) {
			tilemap[i] = 1;
		}
		// Then use the open wall coordinates to set tiles to 0.
		for (let index of openWalls) {
			for (let coords of wallList[index]) {
				tilemap[coords[0] * colormap.width + coords[1]] = 0;
			}
		}
		// And make the rooms 0 as well.
		for (let room of roomList) {
			tilemap[room[0] * colormap.width + room[1]] = 0;
		}
		return tilemap;
	}

}

// Constructs a colormap with some pattern, runs it through the
// functions that perform the maze-generation algorithm, then outputs
// a tilemap.
function initTilemap() {
	// A few different patterns for different kinds of mazes.
	//let colormap = new Colormap([1, 2, 2, 1, 0], 33, 26, false);
	//let colormap = new Colormap([[0, 2, 2], [1, 1, 2], [1, 2, 1]], 33, 25, true);
	let colormap = new Colormap([[2, 1], [1, 0]], 33, 26, true);
	let wallList = genWallList(colormap);
	let roomList = genRoomList(colormap);
	let openWalls = genOpenWalls(wallList, roomList);
	let tilemap = new Tilemap(colormap, wallList, openWalls, roomList);
	changeWallSize(tilemap);
	return tilemap;
}

// Run through the colormap and make a list of "walls", i.e.
// contiguous color blocks. Walls are not necessarily straight, but
// could be in an L-shape or any other contiguous shape.  Each wall is
// stored as an array of arrays, each sub-array consisting of a
// row/column coordinate.
function genWallList(colormap) {
	let wallList = [];
	// A list of rows and associated columns that have already been
	// accounted for as part of a wall.
	let coordSkip = {};
	// Work through the colormap by row and column.
	for (let i = 0; i < colormap.height; i++) {
		for (let j = 0; j < colormap.width; j++) {
			// An index might have already been looked at as part of a
			// wall that started before this index (earlier in the row
			// or in the previous row). If so, skip it.
			if (i in coordSkip && coordSkip[i].includes(j)) {
				continue;
			}
			// Make note of the "color" value (just a number greater
			// than 0).
			let color = colormap.map[i][j];
			// If it is a "color" and not a blank space:
			if (color > 0) {
				// It is part of a wall, so find the rest of the wall.
				let wall = findWall(colormap, i, j, color, []);
				// Work through each coordinate of the wall.
				for (let coord of wall) {
					// If no coordinate in this row has been looked at
					// yet, then add a row key to the associative
					// array coordSkip.
					if (!(coord[0] in coordSkip)) coordSkip[coord[0]] = [];
					// Associate the column value with the row.
					coordSkip[coord[0]].push(coord[1]);
				}
				// Add the wall to the list.
				wallList.push(wall);
			}
		}
	}
	return wallList;
}

// Called by genWallList. Finds contiguous tiles of the same color in
// order to return a set of coordinates constituting a wall. Takes the
// colormap itself, the row/column coordinates, the color value, and a
// wall array that accumulates coordinates (necessary because this is
// a recursive function).
function findWall(colormap, i, j, c, wall) {
	// Check each coordinate so far accumulated.
	for (let coord of wall) {
		// If the current coordinate being examined by the function
		// has already been added to the list, then we do not need to
		// look at its surroundings, because this has already been
		// done. This is how the recursion pulls back from its
		// exploration.
		if (i == coord[0] && j == coord[1]) {
			return;
		}
	}
	// If the tile color is the color we're looking for:
	if (colormap.map[i][j] == c) {
		// Push it onto the list.
		wall.push([i, j]);
		// Then recursively call the function for the surrounding
		// tiles.
		if (i + 1 < colormap.height) findWall(colormap, i + 1, j, c, wall);
		if (i - 1 > 0) findWall(colormap, i - 1, j, c, wall);
		if (j + 1 < colormap.width) findWall(colormap, i, j + 1, c, wall);
		if (j - 1 > 0) findWall(colormap, i, j - 1, c, wall);
	}
	return wall;
}

// Generate a list of rooms from the colormap, i.e. tiles that are not
// a color, indicated by a 0.
function genRoomList(colormap) {
	let roomList = [];
	for (let i = 0; i < colormap.height; i++) {
		for (let j = 0; j < colormap.width; j++) {
			let color = colormap.map[i][j];
			if (color == 0) {
				roomList.push([i, j]);
			}
		}
	}
	// For some of the patterns, the resulting maze will leave some
	// unincorporated spaces at the edges. If we filter them out in
	// advance, the final map will look cleaner.
	roomList = roomList.filter(x => x[0] != 0 &&
							   x[0] != colormap.height - 1 &&
							   x[1] != 0 &&
							   x[1] != colormap.width - 1);

	return roomList;
}

// This function implements Prim's algorithm to generate a maze. It
// takes the generated wallList and roomList, and carves out openings
// in the walls to connect the rooms, returning a list of opened
// walls, i.e. walls that are now just space.
function genOpenWalls(wallList, roomList) {
	// Keeps track of visited rooms.
	let path = [];
	// Queues up walls adjacent to visited rooms to possibly open up
	// later.
	let pathWallList = [];
	// List of walls that have been opened up.
	let openWalls = [];
	// Pick a room from roomList at random and add its array index to
	// the path array.
	let roomIndex = Math.floor(Math.random() * roomList.length);
	path.push(roomIndex);
	// Get the actual room coordinates so that we can look at the
	// walls bordering it. Do this by running down the total list of
	// walls and adding the indexes of the ones that are adjacent to
	// the room to pathWallList.
	let room = roomList[roomIndex];
	for (let i = 0; i < wallList.length; i++) {
		if (findAdjacent(wallList[i], room)) {
			pathWallList.push(i);
		}
	}
	// While there remain walls in the list of walls along the
	// algorithm's path:
	while (pathWallList.length > 0) {
		// Pick at random one of the room-adjacent walls from
		// pathWallList.
		let wallIndex = pathWallList[Math.floor(Math.random() * pathWallList.length)];
		let wall = wallList[wallIndex];
		// Find the rooms that are adjacent to the chosen wall and
		// push indexes to these onto the adjRooms array.
		let adjRooms = [];
		for (let i = 0; i < roomList.length; i++) {
			if (findAdjacent(wall, roomList[i])) {
				adjRooms.push(i);
			}
		}
		// If there are exactly two adjacent rooms:
		if (adjRooms.length == 2) {
			// Check to see if either of these rooms is in the path
			// array, i.e. if it has been visited.
			let unvisited = [];
			for (let room of adjRooms) {
				if (!path.includes(room)) unvisited.push(room);
			}
			// If exactly one of these rooms is unvisited:
			if (unvisited.length == 1) {
				// Add the wall (to which the room in question is
				// adjacent) to the list of opened-up walls.
				openWalls.push(wallIndex);
				// Mark the room as visited.
				path.push(unvisited[0]);
				// Add that room's adjacent walls to the list of
				// room-adjacent walls to be explored in subsequent
				// iterations.
				for (let i = 0; i < wallList.length; i++) {
					if (findAdjacent(wallList[i], roomList[unvisited[0]])) {
						pathWallList.push(i);
					}
				}
			}
		}
		// Remove the opened-up wall from pathWallList.
		pathWallList = pathWallList.filter(x => x != wallIndex);
	}
	return openWalls;
}

// Determines whether a room and a wall are adjacent to one another.
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

// The way that Prim's algorithm carves out the maze results in narrow
// paths. This is maybe not ideal if the maze is being used as a map
// for a game, since we may want a bit more space for the player to
// interact with items and enemies. This function doubles the width of
// the paths as well as the walls to produce a better looking game
// map.
function changeWallSize(tilemap) {
	let newTilemap = [];
	for (let i = 0; i < tilemap.map.length; i++) {
		// For every 1 or 0, push two 1s and 0s onto the tilemap. This
		// takes care of widening paths and walls on the x-axis.
		if (tilemap.map[i] == 1) {
			newTilemap.push(1, 1);
		} else {
			newTilemap.push(0, 0);
		}
		// If we have reached the end of a row:
		if (i % tilemap.width == 0 && i > 0) {
			// Add another row, adding a 1 or 0 for every
			// corresponding 1 or 0 in the row above.
			for (let j = 0; j < tilemap.width * 2; j++) {
				let aboveIndex = newTilemap.length - (tilemap.width * 2);
				if (newTilemap[aboveIndex] == 1) {
					newTilemap.push(1);
				} else {
					newTilemap.push(0);
				}
			}
		}
	}
	tilemap.map = newTilemap;
	tilemap.width *= 2;
}

// Draw the tilemap.
function drawTilemap(tilemap, width) {
	// Size of each tile in pixels.
	let size = 12;
	for (let i = 0; i < tilemap.length; i++) {
		if (tilemap[i] == 0) {
			ctx.strokeStyle = 'black';
			ctx.strokeRect((i % width) * size, Math.floor(i / width) * size, size, size);
		} else {
			ctx.fillStyle = 'black';
			ctx.fillRect((i % width) * size, Math.floor(i / width) * size, size, size);
		}
	}
}

let tilemap = initTilemap();
drawTilemap(tilemap.map, tilemap.width);
