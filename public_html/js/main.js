//This is executed as soon as the page's html is loaded:
var basic;
var csv;

$(document).ready(function () {

    //Determine the dimensions of the diagram, this should be equal to the dimenions of the 'main-view' element
    var mainView = $('#main-view');
    var width = mainView.width();
    var height = mainView.height();

    basic = new Datamap({
        element: document.getElementById("main-view")
    });

    $.get('connectivity.csv', function (data) {
        var fileContents = data;
        csv = d3.csv.parse(fileContents);
        inputColors(csv[21]);
    });

});

function getColor(value) {
    var val = value / 100;

    var r = Math.floor(val * 255);
    var rHex = r.toString(16);
    return "#" + rHex + "0000";
}

function inputColors(row) {
    var json = "{";
    var entries = [];
    for (var country in row) {
        if (row.hasOwnProperty(country) && country !== "Year") {
            entries.push("\""+country+"\":\"" + getColor(row[country]) + "\"");
        }
    }
    json += entries.join(',');
    json += "}";
    console.log(json);
    
    basic.updateChoropleth(JSON.parse(json));
}
