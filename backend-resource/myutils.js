const deepcopy = require('deepcopy');
const _ = require('underscore');


/*	[checkObjectIsEmpty]
 *	
 */
function checkObjectIsEmpty ( obj ) {
	// null and undefined are "empty"
	if (obj == null) return true;
	// Assume if it has a length property with a non-zero value
	// that that property is correct.
	if (obj.length > 0)    return false;
	if (obj.length === 0)  return true;
	// If it isn't an object at this point
	// it is empty, but it can't be anything *but* empty
	// Is it empty?  Depends on your application.
	if (typeof obj !== "object") return true;
	// Otherwise, does it have any properties of its own?
	// Note that this doesn't handle
	// toString and valueOf enumeration bugs in IE < 9
	for (var key in obj) {
		if (hasOwnProperty.call(obj, key)) return false;
	}
	return true;
}

function checkElementIsExistInArray ( item, list ) {
	for (let curItemCount=0; curItemCount<list.length; curItemCount++) {
		let curItem = list[curItemCount];
		if ( _.isEqual(item, curItem) )
			return true;
	}

	// list.forEach(function ( curItem, curItemCount ) {
	// 	if ( curItem == item ) return true;
	// });
	return false;
}



/*	[randomValue]
 *	
 */
function randomValue ( low, high, show=false ) {
	let value = Math.floor(( Math.random() * (high - low + 1) ) + low);
	if ( show === true )
		console.log(`low: ${low}, high: ${high}, random: ${value}`);
    return value;
}



/*	[ipConvertor]
 *	If input data is a string to express IP address, it will return in value.
 *	Otherwise, it will return a IP address as 'X.X.X.X'.
 */
function ipConvertor ( ipData ) {
	if ( !isNaN(ipData) ) {
		let Quotient = [],
			Remainder = [];

		Quotient[0] = ipData;
		for (var i = 0; i < 4; i++) {
			Remainder[i] = Math.floor( Quotient[i] % 256 );
			Quotient[i+1] = Math.floor( Quotient[i] / 256 );
		}

		let mask = Remainder[3];
		for (var i = 2; i >= 0; i--)
			mask = mask + '.' + Remainder[i];
		return mask;
	} else {
		let ipSplit = ipData.trim().split('.');
		return ( ( ((+ipSplit[0]) * 256) + (+ipSplit[1]) ) * 256 + (+ipSplit[2]) ) * 256 + (+ipSplit[3]);
	}
}