var INTERACTION_SELECT = "select";
var INTERACTION_ZOOMIN = "zoom-in";
var INTERACTION_ZOOMOUT = "zoom-out";
var INTERACTION_PAN = "pan";

var mainView;
var worldMap = null;
var csv;
var afterResizeId = 0;

var interactionMode = INTERACTION_SELECT;

var translatedX = 0;
var translatedY = 0;
var scale = 1;

var dragStartX = -1;
var dragStartY = -1;

var noDataFill = "#cccccc";

var mapColorBins = [
    {value: 20, color: "#edf8e9"},
    {value: 40, color: "#bae4b3"},
    {value: 60, color: "#74c476"},
    {value: 80, color: "#31a354"},
    {value: 100, color: "#006d2c"}
];

var waitForFinalEvent = (function () {
    var timers = {};
    return function (callback, ms, uniqueId) {
        if (!uniqueId) {
            uniqueId = "Don't call this twice without a uniqueId";
        }
        if (timers[uniqueId]) {
            clearTimeout(timers[uniqueId]);
        }
        timers[uniqueId] = setTimeout(callback, ms);
    };
})();

var allCountries;
var selectedCountries = [];
var highlightedCountry = null;

$(document).ready(function () {
    mainView = $('#main-view');

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
    $.get('connectivity.csv', function (data) {
        var fileContents = data;
        csv = d3.csv.parse(fileContents);
        renderWorldMap(true);
    });

    $(window).resize(function () {
        renderWorldMap(false);
        waitForFinalEvent(function () {
            afterResizeId = 0;
            renderWorldMap(true);
        }, 500, (afterResizeId++) + "");
    });

    d3.selectAll('#main-view').on('mouseover', function () {
        if (d3.event.target.tagName === "path") {
            var target = d3.select(d3.event.target).data()[0].id;
            addHighlight(target);
            //d3.select(d3.event.target).style({"stroke-width": "3px", "stroke": "f00"});

        }
    });

    d3.selectAll('#main-view').on('mouseout', function () {
        if (d3.event.target.tagName === "path") {
            var target = d3.select(d3.event.target).data()[0].id;
            removeHighlight(target);
            //console.log(d3.select(".datamaps-subunit." + target).data()[0]);
            /*
             var oldAttributes = d3.select(d3.event.target).attr("data-previousAttributes");
             d3.select(d3.event.target).style(oldAttributes);
             */

        }
    });

});

function addHighlight(id) {
    highlightedCountry = id;
    d3.select(".datamaps-subunit." + id).style("fill", "#0f0");
    d3.select("#" + id).style("stroke", '#0f0');

}

function removeHighlight(id) {
    if (highlightedCountry != null) {
        var oldAttributes = d3.select(".datamaps-subunit." + highlightedCountry).attr("data-previousAttributes");
        d3.select(".datamaps-subunit." + highlightedCountry).style(oldAttributes);

        d3.select("#" + highlightedCountry).style("stroke", color(highlightedCountry));

        highlightedCountry = null;
    }


}

function renderWorldMap(renderColors) {

    if (worldMap) {
        d3.selectAll("svg > *").remove();
        $('#main-view').empty();
    }

    worldMap = new Datamap({
        element: document.getElementById("main-view"),
        projection: 'mercator',
        fills: {
            defaultFill: noDataFill
        },
        done: onCountryClick
    });

    if (renderColors) {
        inputColors($("#slider").slider("value"));
    }

    setMouseEvents();
}

function onCountryClick(datamap) {
    datamap.svg.selectAll('.datamaps-subunit').on('click', function (geography) {

        var filterResult = allCountries.filter(function (country) {
            return country.id === geography.id;
        });

        if (filterResult[0] == null) {
            return;
        }

        var clickedCountry = filterResult[0];

        var index = selectedIndex(clickedCountry.id);
        if (index >= 0) {
            selectedCountries.splice(index, 1);
        } else {
            selectedCountries.push(clickedCountry);
        }

        updateColorScale();
        updatePlot();
        inputColors(parseInt($("#year").val()));
    });
}

function updateColorScale() {
    for (var i = 0; i < selectedCountries.length; i++) {
        var newColor = colorDomain.filter(function (country) {
            return country === selectedCountries[i].id;
        });
        if (newColor.length === 0) {
            // selected country is not assigned a color yet
            var assigned = false;
            for (var j = 0; j < colorDomain.length; j++) {
                var insertColor = selectedCountries.filter(function (country) {
                    return country.id === colorDomain[j];
                });
                if (insertColor.length === 0) {
                    colorDomain[j] = selectedCountries[i].id;
                    assigned = true;
                }
            }
            if (!assigned) {
                colorDomain.push(selectedCountries[i].id);
            }
        }
    }

    // clean up
    var cleaning = true;
    while (cleaning) {
        var lastColor = selectedCountries.filter(function (country) {
            return country.id === colorDomain[colorDomain.length - 1];
        });
        if (lastColor.length !== 0) {
            cleaning = false;
        } else {
            colorDomain.splice(colorDomain.length - 1, 1);
        }
    }
    color.domain(colorDomain);
}

function selectedIndex(clickedCountryId) {
    for (var i = 0; i < selectedCountries.length; i++) {
        if (selectedCountries[i].id === clickedCountryId) {
            return i;
        }
    }
    return -1;
}

function getColor(value) {
    if (value === "") {
        return noDataFill;
    }
    var index = 0;
    var currentBin = mapColorBins[index];
    var returnColor = currentBin.color;
    while (currentBin.value <= value) {
        index++;
        currentBin = mapColorBins[index];
        returnColor = currentBin.color;
    }
    return returnColor;
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
            var countryColor = "";
            var colorDomainIndex = colorDomain.indexOf(country);
            if (colorDomainIndex !== -1) {
                countryColor = color.range()[colorDomainIndex];
            } else {
                countryColor = getColor(row[country]);
            }
            entries.push("\"" + country + "\":\"" + countryColor + "\"");
        }
    }
    json += entries.join(',');
    json += "}";
    //console.log(json);

    worldMap.updateChoropleth(JSON.parse(json));
}

function changeCursor() {
    var cursor = 'default';
    switch (interactionMode) {
        case INTERACTION_ZOOMIN:
            cursor = 'zoom-in';
            break;
        case INTERACTION_ZOOMOUT:
            cursor = 'zoom-out';
            break;
        case INTERACTION_PAN:
            cursor = 'all-scroll';
            break;
    }
    mainView.css('cursor', cursor);
}

function setMouseEvents() {
    var zoom = d3.behavior.zoom()
            .scaleExtent([1, 10])
            .on("zoom", onZoom);

    worldMap.svg.call(zoom);
}

function onDragStart(d) {
    var coordinates = [0, 0];
    coordinates = d3.mouse(this);
    dragStartX = coordinates[0];
    dragStartY = coordinates[1];
    //console.log("dragStart: " + dragStartX + ", " + dragStartY);
}

function onDragEnd() {
    dragStartX = -1;
    dragStartY = -1;
    //console.log("dragEnd");
}

function onDrag() {
    var coordinates = [0, 0];
    coordinates = d3.mouse(this);
    var x = coordinates[0];
    var y = coordinates[1];

    if (interactionMode === INTERACTION_PAN) {
        //console.log("pan: " + x + ", " + y);
        pan(x, y);
    }
}

function onZoom(d) {
    d3.select("#main-view svg g")
            .attr("transform", "translate(" + (d3.event.translate) + ")scale(" + d3.event.scale + ")");
}

var outerWidth = $('#linePlot').width();
var outerHeight = $('#linePlot').height();
var margin = {left: 50, top: 50, right: 50, bottom: 50};
var innerWidth = outerWidth - margin.left - margin.right;
var innerHeight = outerHeight - margin.top - margin.bottom;

var outerLinePlotSvg = d3.select('#linePlot').append('svg')
        .attr('width', outerWidth)
        .attr('height', outerHeight);
var linePlotG = outerLinePlotSvg.append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

var xAxisG = linePlotG.append("g")
        .attr("transform", "translate(0," + innerHeight + ")");
var yAxisG = linePlotG.append("g");

var xScale = d3.scale.linear().range([0, innerWidth]);
var yScale = d3.scale.linear().range([innerHeight, 0]);

var xAxis = d3.svg.axis().scale(xScale).orient("bottom")
        .tickFormat(d3.format("04d")) // Use intelligent abbreviations, e.g. 5M for 5 Million
        .outerTickSize(0);  // Turn off the marks at the end of the axis.
var yAxis = d3.svg.axis().scale(yScale).orient("left")
        .ticks(5)                   // Use approximately 5 ticks marks.
        .outerTickSize(0);          // Turn off the marks at the end of the axis.

var line = d3.svg.line()
        //.interpolate("basis")
        .x(function (d) {
            return xScale(d.Year);
        })
        .y(function (d) {
            return yScale(d.Connectivity);
        });


var colorDomain = [];
var color = d3.scale.category10();   // set the colour scale 

function updatePlot() {

    var legendRectSize = 18;
    var legendSpacing = 4;
    color.domain(colorDomain);

    var country = linePlotG.selectAll(".country")
            .data(selectedCountries);

    country.enter().append("path")
            .attr("class", "country");

    country.attr("id", function (d) {
        return d.id;
    })
            .attr("d", function (d) {
                return line(d.values);
            })
            .style("stroke", function (d) {
                return color(d.id);
            })
    /*
     .on('mouseover', function (d) {
     highlight(d.id);
     });
     */

    country.exit().remove();

    var legend = linePlotG.selectAll('.legend')
            .data(selectedCountries);

    var legendEnter = legend.enter()
            .append('g')
            .attr('class', 'legend')
            .attr('transform', function (d, i) {
                var height = legendRectSize + legendSpacing;
                var offset = 0;//height * color.domain().length / 2;
                var horz = legendRectSize;
                var vert = i * height - offset;
                return 'translate(' + horz + ',' + vert + ')';
            });

    legendEnter.append('rect');
    legendEnter.append('text');

    legend.select('rect')
            .attr('width', legendRectSize)
            .attr('height', legendRectSize)
            .style("fill", function (d) {
                return color(d.id);
            })
            .style("stroke", function (d) {
                return color(d.id);
            });

    legend.select('text')
            .attr('x', legendRectSize + legendSpacing)
            .attr('y', legendRectSize - legendSpacing)
            .text(function (d, i) {
                return Datamap.prototype.worldTopo.objects.world.geometries.filter(function (country) {
                    return country.id === selectedCountries[i].id;
                })[0].properties.name;
            });

    legend.exit().remove();

}

function dataInit(data) {
    xScale.domain(d3.extent(data, function (d) {
        return d["Year"];
    }));
    yScale.domain([0, 100]);
    xAxisG.call(xAxis);
    yAxisG.call(yAxis);

    allCountries = d3.keys(data[0]).filter(function (key) {
        return key !== "Year";
    });

    allCountries = allCountries.map(function (country) {
        return {
            id: country,
            values: data.map(function (d) {
                return {Year: d.Year, Connectivity: +d[country]};
            })
        };
    });
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

d3.csv('connectivity.csv', type, dataInit);
