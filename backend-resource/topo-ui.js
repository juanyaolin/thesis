const go = require('../GoJS-master/release/go-debug.js');
const Insp = require('../GoJS-master/extensions/DataInspector.js').Inspector;
const pictures = `${__dirname}/pictures`
// const go = require('../GoJS-master/release/go.js');

function init () {
	// $('<div id="topo-diagram" style="border:solid 1px black; width:100%; height:400px"></div>').appendTo('div.block-body');
	$('<div id="topo-diagram" class="col-sm-9 widget-box" style="height:400px"></div>').appendTo('div.block-body');
	$('<div id="topo-button" class="col-sm-3 widget-box" style="height:400px"></div>').appendTo('div.block-body')
		.append('<button class="btn btn-inverse">Import ACL</button>')
		.append('');
	// append script

	let $s = go.GraphObject.make;

	myDiagram = $s(go.Diagram, 'topo-diagram', {
		initialContentAlignment: go.Spot.Center,
		'undoManager.isEnabled': true
	});

	myDiagram.nodeTemplate =
		$s(go.Node, 'Vertical', 
			$s(go.TextBlock, 'Default Text', {font: "bold 16px sans-serif"},new go.Binding('text', 'key')),
			$s(go.Picture, {width: 50, height: 50}, new go.Binding('source'))
		);

	myDiagram.linkTemplate = 
		$s(go.Link,
			$s(go.Shape)
		);

	let nodeDataArray = [
		{ key: 'nw1', source: `${pictures}/network.png` },
		{ key: 'nw2', source: `${pictures}/network.png` },
		{ key: 'fw1', source: `${pictures}/firewall-gray.png` },
		{ key: 'fw2', source: `${pictures}/firewall-gray.png` },
		{ key: 'fw3', source: `${pictures}/firewall-gray.png` }
	];

	let linkDataArray = [
		{ from: 'nw1', to: 'fw1' },
		{ from: 'fw1', to: 'fw2' },
		{ from: 'fw1', to: 'fw3' },
		{ from: 'fw2', to: 'fw3' },
		{ from: 'fw2', to: 'nw2' }
	];

	myDiagram.model = new go.GraphLinksModel(nodeDataArray, linkDataArray);
	// document.getElementById('').textContent = myDiagram.model.toJson();
	myDiagram.select(myDiagram.nodes.first());

	let inspector = new Insp('topo-button', myDiagram, {
		
		properities: {
			"text": { },
			"key": { readOnly: true, show: Insp.showIfPresent },
		}
	});
}


module.exports.init = init;