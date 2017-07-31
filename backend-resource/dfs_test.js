const stackMaximum = Math.pow(2, 30) - 1;
let stack, stackTop;
// let pathList = [], path = [];
let topo = {
	'nw1': { 'fw1': true },
	'fw1': { 'nw1': 'eth0', 'fw2': 'eth1', 'fw3': 'eth2' },
	'fw2': { 'fw1': 'eth0', 'fw3': 'eth1', 'nw2': 'eth2' },
	'fw3': { 'fw1': 'eth0', 'fw2': 'eth1' },
	'nw2': { 'fw2': true }
};

dijkstra('nw1', 'nw2');

function dijkstra ( start, end ) {
	let node;
	let count = 0;
	let path = [];

	init_stack();
	push_to_stack(start);
	while ( stack ) {
		node = pop_from_stack();
		if ( !node ) break;
		path.push(node);
		if ( node == end ) break;
		


	}
	console.log(path);
}

function init_stack () {
	stack = [];
	stackTop = -1
}

function push_to_stack ( node ) {
	stackTop++;
	if ( stackTop == stackMaximum ) {
		console.log('stack full');
	}
	stack[stackTop] = node;
}

function pop_from_stack () {
	let node = stack[stackTop];
	stackTop--;
	return node;
}
