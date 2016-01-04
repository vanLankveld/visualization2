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

    // Create slider
    $("#slider").slider({
        value: 2000,
        min: 1990,
        max: 2011,
        step: 1,
        slide: function (event, ui) {
            $("#year").val(ui.value);
            inputColors(ui.value);
        }
    });
    // Initialize value
    $("#year").val($("#slider").slider("value"));
    
    // Load CSV and initialize colors
    $.get('connectivity.csv', function (data) {
        var fileContents = data;
        csv = d3.csv.parse(fileContents);
        inputColors($("#slider").slider("value"));
    });
    
});

function getColor(value) {
    var val = value / 100;

    var r = Math.floor(val * 255);
    var rHex = ("0"+r.toString(16)).substr(-2);
    return "#" + rHex + "0000";
}

function inputColors(year) {
    var index=0;
    for(var row in csv){
        if(csv[row]["Year"]===year.toString()){
            index=row;
        }
    }
    
    var row = csv[index];
    var json = "{";
    var entries = [];
    for (var country in row) {
        if (row.hasOwnProperty(country) && country !== "Year") {
            entries.push("\"" + country + "\":\"" + getColor(row[country]) + "\"");
        }
    }
    json += entries.join(',');
    json += "}";
    //console.log(json);

    basic.updateChoropleth(JSON.parse(json));
}
