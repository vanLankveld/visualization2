//This is executed as soon as the page's html is loaded:
var basic;
var csv;
var dataNest;

$(document).ready(function () {
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

    // Create dialog
    $(function () {
        $("#dialog").dialog({
            width: 1.1 * outerWidth,
            title: yColumn
        });
    });


    $.get('connectivity.csv', function (data) {
        var fileContents = data;
        csv = d3.csv.parse(fileContents);
        renderWorldMap();
    });


});

function renderWorldMap() {
    basic = new Datamap({
        element: document.getElementById("main-view"),
//        responsive: true,
        done: function (datamap) {
            datamap.svg.selectAll('.datamaps-subunit').on('click', function (geography) {
                yColumn = geography.id;
                $('#dialog').dialog("option", "title", geography.properties.name);
                updatePlot();
                /*
                 var m = {};
                 m[geography.id] = '#000000';
                 basic.updateChoropleth(m);
                 */
            });
        }
    });

    inputColors($("#slider").slider("value"));
}

function getColor(value) {
    var val = value / 100;

    var r = Math.floor(val * 255);
    var rHex = ("0" + r.toString(16)).substr(-2);
    return "#" + rHex + "0000";
}

function inputColors(year) {
    var index = 0;
    for (var row in csv) {
        if (csv[row]["Year"] === year.toString()) {
            index = row;
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

////////////////////////////////////////////////////////////////////
////////////////// TESTING /////////////////////////////////////////
////////////////////////////////////////////////////////////////////

var outerWidth = 700;
var outerHeight = 700;
var margin = {left: 50, top: 50, right: 50, bottom: 50};
var innerWidth = outerWidth - margin.left - margin.right;
var innerHeight = outerHeight - margin.top - margin.bottom;

var xColumn = "Year";
var yColumn = "NLD";

var svg = d3.select('#dialog').append('svg')
        .attr('width', outerWidth)
        .attr('height', outerHeight);
var g = svg.append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

var xAxisG = g.append("g")
        .attr("transform", "translate(0," + innerHeight + ")");
var yAxisG = g.append("g");

var xScale = d3.scale.linear().range([0, innerWidth]);
var yScale = d3.scale.linear().range([innerHeight, 0]);

var xAxis = d3.svg.axis().scale(xScale).orient("bottom")
        .tickFormat(d3.format("04d")) // Use intelligent abbreviations, e.g. 5M for 5 Million
        .outerTickSize(0);  // Turn off the marks at the end of the axis.
var yAxis = d3.svg.axis().scale(yScale).orient("left")
        .ticks(5)                   // Use approximately 5 ticks marks.
        .outerTickSize(0);          // Turn off the marks at the end of the axis.

var path = g.append("path");
/*
 var line = d3.svg.line()
 .x(function (d) {
 return xScale(d[xColumn]);
 })
 .y(function (d) {
 return yScale(d[yColumn]);
 });
 */
var line = d3.svg.line()
        //.interpolate("basis")
        .x(function (d) {
            return xScale(d.Year);
        })
        .y(function (d) {
            return yScale(d.Connectivity);
        });


function updatePlot() {
    g.select(".country").attr("d", line);
}

function render(data) {
    xScale.domain(d3.extent(data, function (d) {
        return d["Year"];
    }));
    yScale.domain([0, 100]);
    xAxisG.call(xAxis);
    yAxisG.call(yAxis);
    /*
     g.append("path")
     .datum(data)
     .attr("class", "plot")
     .attr("d", line);
     */

    dataNest = d3.keys(data[0]).filter(function (key) {
        return key !== "Year";
    });

    dataNest = dataNest.map(function (country) {
        return {
            name: country,
            values: data.map(function (d) {
                return {Year: d.Year, Connectivity: +d[country]};
            })
        };
    });

    var country = g.selectAll(".country")
            .data(dataNest)
            .enter().append("g")
            .attr("class", "country");

    country.append("path")
            .attr("class", "line")
            .attr("id", function(d) { return d.name;})
            .attr("d", function (d) {
                return line(d.values);
            });
    
    //country.exit().remove();
    
    /*
     dataNest = d3.nest()
     .key(function(d) {return d.NLD;})
     .entries(data);
     
     path.data(data)    // Doesn't seem to work, missing enter?
     .attr("class", "plot")
     .attr("d", line);
     /*
     path.attr("d", line(data));
     */
}

function type(d) {
    for (var col in d) {
        if (d.hasOwnProperty(col) && col !== "Year") {
            d[col] = +d[col];
        } else if (col === "Year") {
            d[col] = +d[col];
        }
    }
    return d;
}

d3.csv('connectivity.csv', type, render);
