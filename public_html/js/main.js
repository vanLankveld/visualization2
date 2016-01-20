var MODE_DEFAULT = "default";
var MODE_DIFF = "diff";

var mainView;
var worldMap = null;
var csv;
var afterResizeId = 0;

var translatedX = 0;
var translatedY = 0;
var scale = 1;

var dragStartX = -1;
var dragStartY = -1;

var mode = MODE_DEFAULT;

var noDataFill = {
    selection: "#bbbbbb",
    noData: "#dddddd"
};

var mapColorBins = [
    {value: 20, color: "#eff3ff"},
    {value: 40, color: "#bdd7e7"},
    {value: 60, color: "#6baed6"},
    {value: 80, color: "#3182bd"},
    {value: 100, color: "#08519c"}
];

var mapDiffColorBins = [
    {value: -100, color: "#fcae91"},
    {value: 0, color: "#edf8e9"},
    {value: 20, color: "#bae4b3"},
    {value: 40, color: "#74c476"},
    {value: 60, color: "#238b45"}
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
    setSlider();

    $.get('connectivity.csv', function (data) {
        var fileContents = data;
        csv = d3.csv.parse(fileContents);
        renderWorldMap(true);
    });

    $("#divMode").buttonset();

    $("#divMode input").change(function () {
        mode = $(this).val();
        setSlider();
        if (mode === MODE_DEFAULT) {
            inputColors($("#slider").slider("value"));
        } else if (mode === MODE_DIFF) {
            var yearStart = $("#slider").slider("values", 0);
            var yearEnd = $("#slider").slider("values", 1);
            inputColors(yearStart, yearEnd);
        }
    });

    $(window).resize(function () {
        renderWorldMap(false);
        waitForFinalEvent(function () {
            afterResizeId = 0;
            renderWorldMap(true);
        }, 500, (afterResizeId++) + "");
    });

    // Highlighting listener (enter en leave)
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

function setSlider() {
    var value = $("#slider").slider("values", 0);
    if (isNaN(parseInt(value))) {
        value = 2000;
    }
    $("#slider").remove();
    var slider = $(document.createElement("div"));
    slider.attr("id", "slider");
    $("#divSliderContainer").append(slider);
    $("#slider").slider({
        range: false,
        value: value,
        min: 1990,
        max: 2011,
        step: 1,
        slide: function (event, ui) {
            if (mode === MODE_DEFAULT) {
                $("#year").val(ui.value);
            } else if (mode === MODE_DIFF) {
                $("#year").val(ui.values[0] + " to " + ui.values[1]);
            }
            if (mode === MODE_DEFAULT) {
                inputColors(ui.value);
            } else if (mode === MODE_DIFF) {
                inputColors(ui.values[0], ui.values[1]);
            }
        }
    });

    if (mode === MODE_DIFF) {

        var value1 = parseInt(value);
        var value2 = value1 + 1;
        if (value2 > $("#slider").slider("option", "max")) {
            value2 = value1 - 1;
        }

        $("#slider").slider({
            range: true,
            values: [value1, value2]
        });
        $("#year").val($("#slider").slider("values", 0) + " to " + $("#slider").slider("values", 1));
    }
    else if (mode === MODE_DEFAULT) {
        $("#year").val($("#slider").slider("value"));
    }

    // Initialize value
    $("#year").val($("#slider").slider("value"));
}

function addHighlight(id) {
    // Set highlighted Country
    highlightedCountry = id;

    // Highlight dataMap
    d3.select(".datamaps-subunit." + id).style("stroke-width", "5px");

    // Highlight LinePlot
    d3.select("#" + id).style("stroke-width", "5px");
}

function removeHighlight(id) {

    if (highlightedCountry != null) {
        // unSet dataMap highlight
        var oldAttributes = d3.select(".datamaps-subunit." + highlightedCountry).attr("data-previousAttributes");

        d3.select(".datamaps-subunit." + highlightedCountry).style(oldAttributes);

        d3.select(".datamaps-subunit." + id).style("stroke-width", "1px");

        d3.select(".datamaps-subunit." + highlightedCountry).style('fill', getSingleCountryColor(highlightedCountry, parseInt($("#slider").slider("value"))));


        // unSet LinePlot highlight
        d3.select("#" + highlightedCountry).style("stroke-width", "2px");

        // unSet global variable
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
            defaultFill: noDataFill.noData
        },
        done: onCountryClick,
        geographyConfig: {
            highlightOnHover: false/*,
             highlightFillColor: 'rgba(0,0,0,0.1)',
             highlightBorderColor: 'rgba(0, 0, 0, 0.2)',
             highlightBorderWidth: 3,
             highlightBorderOpacity: 0.2*/
        }
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


        var barChart = d3.select("#barChart");
        if (selectedCountries.length > 0 && barChart.style("display") === "block") {
            $("linePlot").show();
            $("diffLinePlot").show();
            $("#barChart").hide();
        } else if (selectedCountries.length === 0 && barChart.style("display") === "none") {
            $("linePlot").hide();
            $("diffLinePlot").hide();
            $("#barChart").show();
        }

        if (selectedCountries.length > 0) {
            // LinePlot mode
            updateColorScale();
            updatePlot();
        } else {
            // BarChart mode

        }

        inputColors(parseInt($("#slider").slider("value")));

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
        if (lastColor.length !== 0 || colorDomain.length === 0) {
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

function getColor(value, mode) {
    if (mode === undefined) {
        mode = MODE_DEFAULT;
    }

    if (value === "") {
        return noDataFill.noData;
    } else if (selectedCountries.length > 0) {
        return noDataFill.selection;
    }

    var bins;
    if (mode === MODE_DEFAULT) {
        bins = mapColorBins;
    } else if (mode === MODE_DIFF) {
        bins = mapDiffColorBins;
    }

    var index = 0;
    var currentBin = bins[index];
    var returnColor = currentBin.color;
    while (currentBin !== undefined && currentBin.value <= value) {
        returnColor = currentBin.color;
        index++;
        currentBin = bins[index];
    }
    return returnColor;
}

function selectedCountryIndex(country) {
    for (var i = 0; i < selectedCountries.length; i++) {
        var selectedCountry = selectedCountries[i];
        if (selectedCountry.id.toLowerCase() === country.toLowerCase()) {
            return i;
        }
    }
    return -1;
}

function getSingleCountryColor(country, year) {
    for (var row in csv) {
        if (csv[row]["Year"] === year.toString()) {
            index = row;
        }
    }
    var row = csv[index];

    var selectedIndex = selectedCountryIndex(country);

    if (selectedIndex !== -1) {
        return color(country);
    }
    return getColor(row[country]);
}

function getSingleCountryDiffColor(country, yearStart, yearEnd) {
    var dValue = getDiffForCountry(country, yearStart, yearEnd);
    return getColor(dValue, "diff");
}

function getDiffForCountry(country, yearStart, yearEnd, asDerivative) {
    var valueStart = "";
    var valueEnd = "";

    var dYear = 0;
    var inRange;

    for (var row in csv) {
        if (csv[row]["Year"] === yearStart.toString()) {
            inRange = true;
            valueStart = csv[row][country];
        } else if (csv[row]["Year"] === yearEnd.toString()) {
            inRange = false;
            valueEnd = csv[row][country];
        }
        if (inRange) {
            dYear++;
        }
    }

    if (valueStart === "" || valueEnd === "") {
        return "";
    }

    var dValue = (valueEnd - valueStart);

    if (asDerivative) {
        return dValue / dYear;
    }

    return dValue;
}

function inputColors(yearStart, yearEnd) {

    if (yearEnd !== undefined) {
        var countryList = [];

        for (var key in csv[0]) {
            if (key !== "Year") {
                countryList.push(key);
            }
        }

        var json = "{";
        var entries = [];
        for (var i in countryList) {
            var country = countryList[parseInt(i)];
            var countryColor = "";

            var selectedIndex = selectedCountryIndex(country);
            if (selectedIndex !== -1) {
                countryColor = color(country);
            } else {
                countryColor = getSingleCountryDiffColor(country, yearStart, yearEnd);
            }
            entries.push("\"" + country + "\":\"" + countryColor + "\"");
        }
        json += entries.join(',');
        json += "}";

        worldMap.updateChoropleth(JSON.parse(json));
        return;
    }
    var year = yearStart;
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

            var selectedIndex = selectedCountryIndex(country);
            if (selectedIndex !== -1) {
                countryColor = color(country);
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

function setMouseEvents() {
    var zoom = d3.behavior.zoom()
            .scaleExtent([1, 10])
            .on("zoom", onZoom);

    worldMap.svg.call(zoom);
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
    xAxisG.call(xAxis);
    yAxisG.call(yAxis);

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
            .on('mouseover', function (d) {
                addHighlight(d.id);
            })
            .on('mouseleave', function (d) {
                removeHighlight(d.id);
            });


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
