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

var zoom;

var noDataFill = {
    selection: "#bbbbbb",
    noData: "#dddddd"
};

var defaultColorBins = d3.scale.threshold()
        .domain([20, 40, 60, 80, 100])
        .range(["#eff3ff", "#bdd7e7", "#6baed6", "#3182bd", "#08519c", "#000000"]);

var diffColorBins = d3.scale.threshold()
        .domain([0, 20, 40, 60])
        .range(["#fcae91", "#edf8e9", "#bae4b3", "#74c476", "#238b45"]);

// Create the measurement node for scroll-bar measurement
var scrollDiv = document.createElement("div");
scrollDiv.className = "scrollbar-measure";
document.body.appendChild(scrollDiv);

// Get the scrollbar width
var scrollbarWidth = scrollDiv.offsetWidth - scrollDiv.clientWidth;
//console.warn(scrollbarWidth); // Mac:  15

// Delete the DIV 
document.body.removeChild(scrollDiv);

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

var allCountries = null;
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

    setButtons();

    $(window).resize(function () {
        renderWorldMap(false);
        waitForFinalEvent(function () {
            afterResizeId = 0;
            renderWorldMap(true);
        }, 500, (afterResizeId++) + "");
    });

    setLegend();

    // Highlighting listener (enter en leave)
    d3.selectAll('#main-view').on('mouseover', function () {
        if (d3.event.target.tagName === "path") {
            var target = d3.select(d3.event.target).data()[0].id;
            addHighlight(target);

        }
    });

    d3.selectAll('#main-view').on('mouseout', function () {
        if (d3.event.target.tagName === "path") {
            var target = d3.select(d3.event.target).data()[0].id;
            removeHighlight(target);
        }
    });

});

function setButtons() {
    $("#divMode").buttonset();

    $("#divMode input").change(function () {
        mode = $(this).val();
        setSlider();
        redrawColors();
        $("#cbSortValues").prop("checked", false);
        $("#cbSortValues").button("refresh");
        updateBarChart();
    });

    $("#btResetView").button();
    $("#btClearSelection").button();
    $("#cbShowLegend").button();
    $("#cbSortValues").button();

    $("#cbShowLegend").change(function () {
        var checked = $("#cbShowLegend").prop("checked");
        if (checked) {
            $("#divLegend").dialog("open");
        }
        else {
            $("#divLegend").dialog("close");
        }
    });

    $("#btResetView").click(function () {
        resetView();
    });

    $("#btClearSelection").click(function () {
        selectedCountries = [];
        updateSelection();
    });
}

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
        min: 1990,
        max: 2011,
        value: value,
        step: 1,
        slide: function (event, ui) {
            if (mode === MODE_DEFAULT) {
                $("#year").text(ui.value);
            } else if (mode === MODE_DIFF) {
                $("#year").text(ui.values[0] + " to " + ui.values[1]);
            }
            if (mode === MODE_DEFAULT) {
                inputColors(ui.value);
                updateBarChart(ui.value);
            } else if (mode === MODE_DIFF) {
                inputColors(ui.values[0], ui.values[1]);
                updateBarChart(ui.values[0], ui.values[1]);
            }
            $("#cbSortValues").prop("checked", false);
            $("#cbSortValues").button("refresh");
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
        $("#year").text($("#slider").slider("values", 0) + " to " + $("#slider").slider("values", 1));
    } else if (mode === MODE_DEFAULT) {
        $("#year").text($("#slider").slider("value"));
    }
}

function setLegend() {
    var show = $('#cbShowLegend').prop('checked');

    $("#divLegend").dialog({
        autoOpen: show,
        position: {my: "left bottom", at: "left bottom", of: mainView},
        close: function () {
            $("#cbShowLegend").prop("checked", false);
            $("#cbShowLegend").button("refresh");
        }
    });
}

function redrawColors() {
    if (mode === MODE_DEFAULT) {
        inputColors($("#slider").slider("value"));
    } else if (mode === MODE_DIFF) {
        var yearStart = $("#slider").slider("values", 0);
        var yearEnd = $("#slider").slider("values", 1);
        inputColors(yearStart, yearEnd);
    }
}

function addHighlight(id) {
    // Set highlighted Country
    highlightedCountry = id;

    // Highlight dataMap
    d3.select(".datamaps-subunit." + id).style("stroke-width", "5px");
    d3.select(".datamaps-subunit." + id).style("stroke", "#000");

    // Highlight LinePlot and diffPlot
    d3.selectAll("#" + highlightedCountry).classed("highlighted", true);
}

function removeHighlight(id) {

    if (highlightedCountry != null) {

        // unSet LinePlot highlight
        d3.selectAll("#" + highlightedCountry).classed("highlighted", false);

        // unSet dataMap highlight
        var oldAttributes = d3.select(".datamaps-subunit." + highlightedCountry).attr("data-previousAttributes");

        d3.select(".datamaps-subunit." + highlightedCountry).style(oldAttributes);


        d3.select(".datamaps-subunit." + highlightedCountry).style("stroke-width", "1px");
        d3.select(".datamaps-subunit." + highlightedCountry).style("stroke", "#fff");


        var oldColor;
        if (mode === MODE_DEFAULT) {
            oldColor = getSingleCountryColor(highlightedCountry, parseInt($("#slider").slider("value")));
        } else if (mode === MODE_DIFF) {
            oldColor = getSingleCountryDiffColor(highlightedCountry, parseInt($("#slider").slider("values", 0)), parseInt($("#slider").slider("values", 1)));
        }

        d3.select(".datamaps-subunit." + highlightedCountry).style('fill', oldColor);

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
        done: function (datamap) {
            datamap.svg.selectAll('.datamaps-subunit').on('click', handleClick);
        },
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

function handleClick(object) {
    var filterResult = allCountries.filter(function (country) {
        return country.id === object.id;
    });

    if (filterResult[0] === null) {
        return;
    }

    var clickedCountry = filterResult[0];

    var index = selectedIndex(clickedCountry.id);
    if (index >= 0) {
        selectedCountries.splice(index, 1);
    } else {
        selectedCountries.push(clickedCountry);
    }

    updateSelection();

}

function updateSelection() {
    var barChart = d3.select("#barChart");
    if (selectedCountries.length > 0 && barChart.style("display") === "block") {
        $("#linePlot").show();
        $("#diffLinePlot").show();
        $('#barChartTitle').hide();
        $("#barChart").hide();
        $('#barChartXAxis').hide();
    } else if (selectedCountries.length === 0 && barChart.style("display") === "none") {
        $("#linePlot").hide();
        $("#diffLinePlot").hide();
        $('#barChartTitle').show();
        $("#barChart").show();
        $('#barChartXAxis').show();
    }

    if (selectedCountries.length > 0) {
        // LinePlot mode
        updateColorScale();
        updatePlot();
    } else {
        // BarChart mode
        updateBarChart();
        $("#cbSortValues").prop("checked", false);
        $("#cbSortValues").button("refresh");
    }

    redrawColors();
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
        bins = defaultColorBins;
    } else if (mode === MODE_DIFF) {
        bins = diffColorBins;
    }

    return bins(value);
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
    zoom = d3.behavior.zoom()
            .scaleExtent([1, 10])
            .on("zoom", onZoom);

    worldMap.svg.call(zoom);
}

function onZoom(d) {
    d3.select("#main-view svg g")
            .attr("transform", "translate(" + (d3.event.translate) + ")scale(" + d3.event.scale + ")");
}

function resetView() {
    zoom.scale(1);
    zoom.translate([0, 0]);
    d3.select("#main-view svg g")
            .transition()
            .attr("transform", "translate(0)scale(1)");
}

// Line Plot
var linePlotOuterWIdth = $('#linePlot').width();
var linePlotOuterHeight = $('#linePlot').height();
var linePlotMargin = {left: 50, top: 50, right: 50, bottom: 50};
var linePlotInnerWidth = linePlotOuterWIdth - linePlotMargin.left - linePlotMargin.right;
var linePlotInnerHeight = linePlotOuterHeight - linePlotMargin.top - linePlotMargin.bottom;

var outerLinePlotSvg = d3.select('#linePlot').append('svg')
        .attr('width', linePlotOuterWIdth)
        .attr('height', linePlotOuterHeight);
var linePlotG = outerLinePlotSvg.append("g")
        .attr("transform", "translate(" + linePlotMargin.left + "," + linePlotMargin.top + ")");

var linePlotXAxisG = linePlotG.append("g")
        .attr("transform", "translate(0," + linePlotInnerHeight + ")");
var linePlotYAxisG = linePlotG.append("g");

var linePlotXScale = d3.scale.linear().range([0, linePlotInnerWidth]);
var linePlotYScale = d3.scale.linear().range([linePlotInnerHeight, 0]);

var linePlotXAxis = d3.svg.axis().scale(linePlotXScale).orient("bottom")
        .tickFormat(d3.format("04d")) // Use intelligent abbreviations, e.g. 5M for 5 Million
        .outerTickSize(0);  // Turn off the marks at the end of the axis.
var linePlotYAxis = d3.svg.axis().scale(linePlotYScale).orient("left")
        .ticks(5)                   // Use approximately 5 ticks marks.
        .outerTickSize(0);          // Turn off the marks at the end of the axis.

var linePlotLine = d3.svg.line()
        //.interpolate("basis")
        .x(function (d) {
            return linePlotXScale(d.Year);
        })
        .y(function (d) {
            return linePlotYScale(d.Connectivity);
        });

// diffLine Plot
var diffLinePlotOuterWIdth = $('#diffLinePlot').width();
var diffLinePlotOuterHeight = $('#diffLinePlot').height();
var diffLinePlotMargin = {left: 50, top: 50, right: 50, bottom: 50};
var diffLinePlotInnerWidth = diffLinePlotOuterWIdth - diffLinePlotMargin.left - diffLinePlotMargin.right;
var diffLinePlotInnerHeight = diffLinePlotOuterHeight - diffLinePlotMargin.top - diffLinePlotMargin.bottom;

var outerDiffLinePlotSvg = d3.select('#diffLinePlot').append('svg')
        .attr('width', diffLinePlotOuterWIdth)
        .attr('height', diffLinePlotOuterHeight);
var diffLinePlotG = outerDiffLinePlotSvg.append("g")
        .attr("transform", "translate(" + diffLinePlotMargin.left + "," + diffLinePlotMargin.top + ")");

var diffLinePlotXAxisG = diffLinePlotG.append("g")
        .attr("transform", "translate(0," + diffLinePlotInnerHeight + ")");
var diffLinePlotYAxisG = diffLinePlotG.append("g");

var diffLinePlotXScale = d3.scale.linear().range([0, diffLinePlotInnerWidth]);
var diffLinePlotYScale = d3.scale.linear().range([diffLinePlotInnerHeight, 0]);

var diffLinePlotXAxis = d3.svg.axis().scale(diffLinePlotXScale).orient("bottom")
        .tickFormat(d3.format("04d")) // Use intelligent abbreviations, e.g. 5M for 5 Million
        .outerTickSize(0);  // Turn off the marks at the end of the axis.
var diffLinePlotYAxis = d3.svg.axis().scale(diffLinePlotYScale).orient("left")
        .ticks(5)                   // Use approximately 5 ticks marks.
        .outerTickSize(0);          // Turn off the marks at the end of the axis.

var diffLinePlotLine = d3.svg.line()
        //.interpolate("basis")
        .x(function (d) {
            return diffLinePlotXScale(d.Year);
        })
        .y(function (d) {
            return diffLinePlotYScale(d.diffConnectivity);
        });

// Legend
var legendSvg = d3.select('#divLegend').append('svg')
        .attr('width', 250)
        .attr('height', $('#divLegend').height());
var legendG = legendSvg
        .append('g');

var colorDomain = [];
var color = d3.scale.category10();   // set the colour scale 

// Bar chart
var barChartMargin = {left: 100, top: 50, right: 50, bottom: 0};
var barChartOuterWidth = $('#barChart').width() - 2 * scrollbarWidth;
var barChartOuterHeight = 4 * $('#barChart').height();
var barChartInnerWidth = barChartOuterWidth - barChartMargin.left - barChartMargin.right;
var barChartInnerHeight = barChartOuterHeight - barChartMargin.top - barChartMargin.bottom;

var barChartYScale = d3.scale.ordinal()
        .rangeBands([barChartInnerHeight, 0], 0.1);
var barChartXScale = d3.scale.linear()
        .range([0, barChartInnerWidth]);

var barChartXAxis = d3.svg.axis()
        .scale(barChartXScale)
        .orient("bottom");
var barChartYAxis = d3.svg.axis()
        .scale(barChartYScale)
        .orient("left");

var outerBarChartSvg = d3.select('#barChart').append('svg')
        .attr('width', barChartOuterWidth)
        .attr('height', barChartOuterHeight);
var barChartG = outerBarChartSvg.append("g")
        .attr("transform", "translate(" + barChartMargin.left + "," + barChartMargin.top + ")");
var barChartXAxisG = d3.select('#barChartXAxis').append('svg')
        .attr('width', $('#barChartXAxis').width())
        .attr('height', Math.floor($('#barChartXAxis').height()))
        .append("g")
        .attr("transform", "translate(" + barChartMargin.left + ",0)")
        .attr("class", "x axis");
var barChartYAxisG = barChartG.append("g")
        .attr("class", "y axis");


function updateBarChart(yearStart, yearEnd) {
    if (mode === MODE_DEFAULT) {
        if (yearStart === undefined) {
            yearStart = $('#slider').slider("value");
        }
        barChartXScale.domain([0, 100]);
    } else if (mode === MODE_DIFF) {
        if (yearStart === undefined || yearEnd === undefined) {
            yearStart = $('#slider').slider("values", 0);
            yearEnd = $('#slider').slider("values", 1);
        }
        barChartXScale.domain([-100, 100]);
    }

    barChartYScale.domain(allCountries.map(function (d) {
        return d.id;
    }));

    barChartXAxisG.call(barChartXAxis);
    barChartYAxisG.call(barChartYAxis);

    var rects = barChartG.selectAll(".bar")
            .data(allCountries);

    rects.enter().append("rect")
            .attr("class", "bar");

    rects.attr("y", function (d) {
        return barChartYScale(d.id);
    })
            .attr("height", barChartYScale.rangeBand())
            .attr("id", function (d) {
                return d.id;
            })
            .on('mouseover', function (d) {
                addHighlight(d.id);
            })
            .on('mouseleave', function (d) {
                removeHighlight(d.id);
            })
            .on('click', handleClick);

    if (mode === MODE_DEFAULT) {
        rects
                .attr("x", 0)
                .attr("width", function (d) {
                    return barChartXScale(getCurrentConnectivity(d, yearStart));
                })
                .style("fill", function (d) {
                    return defaultColorBins(getCurrentConnectivity(d, yearStart));
                });
    } else if (mode === MODE_DIFF) {
        rects
                .attr("x", function (d) {
                    return barChartXScale(d3.min([0, getCurrentConnectivity(d, yearEnd) - getCurrentConnectivity(d, yearStart)]));
                })
                .attr("width", function (d) {
                    return Math.abs(barChartXScale(getCurrentConnectivity(d, yearEnd)) - barChartXScale(getCurrentConnectivity(d, yearStart)));
                    //return barChartXScale(getCurrentConnectivity(d, yearEnd) - getCurrentConnectivity(d, yearStart));
                })
                .style("fill", function (d) {
                    return diffColorBins(getCurrentConnectivity(d, yearEnd) - getCurrentConnectivity(d, yearStart));
                });
    }

    updateLegend();
}

function updatePlot() {
// Line Plot
    linePlotXAxisG.call(linePlotXAxis);
    linePlotYAxisG.call(linePlotYAxis);

    var country = linePlotG.selectAll(".country")
            .data(selectedCountries);

    country.enter().append("path")
            .attr("class", "country");

    country.attr("id", function (d) {
        return d.id;
    })
            .attr("d", function (d) {
                return linePlotLine(d.values);
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

    // diffLine Plot
    diffLinePlotXAxisG.call(diffLinePlotXAxis);
    diffLinePlotYAxisG.call(diffLinePlotYAxis);

    var countryDiff = diffLinePlotG.selectAll(".countryDiff")
            .data(selectedCountries);

    countryDiff.enter().append("path")
            .attr("class", "countryDiff");

    countryDiff.attr("id", function (d) {
        return d.id;
    })
            .attr("d", function (d) {
                return diffLinePlotLine(d.diffValues);
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

    countryDiff.exit().remove();

    updateLegend();

}

function updateLegend() {
    var legend;
    var legendRectSize = 18;
    var legendSpacing = 4;

    if (selectedCountries.length > 0) {
        legend = legendG.selectAll('.legend')
                .data(selectedCountries);
    } else if (mode === MODE_DEFAULT) {
        legend = legendG.selectAll('.legend')
                .data(defaultColorBins.range());
    } else if (mode === MODE_DIFF) {
        legend = legendG.selectAll('.legend')
                .data(diffColorBins.range());
    }


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
            .style("fill", function (d, i) {
                if (selectedCountries.length > 0) {
                    return color(d.id);
                } else if (mode === MODE_DEFAULT) {
                    return defaultColorBins.range()[i];
                } else if (mode === MODE_DIFF) {
                    return diffColorBins.range()[i];
                }
            })
            .style("stroke", function (d, i) {
                return "#000";
                //return color(d.id);
            });

    legend.select('text')
            .attr('x', legendRectSize + legendSpacing)
            .attr('y', legendRectSize - legendSpacing)
            .text(function (d, i) {
                if (selectedCountries.length > 0) {
                    return Datamap.prototype.worldTopo.objects.world.geometries.filter(function (country) {
                        return country.id === selectedCountries[i].id;
                    })[0].properties.name;
                } else if (mode === MODE_DEFAULT) {
                    return defaultColorBins.invertExtent(defaultColorBins.range()[i]);
                } else if (mode === MODE_DIFF) {
                    return diffColorBins.invertExtent(diffColorBins.range()[i]);
                }

            });

    legend.exit().remove();
}

function getCurrentConnectivity(d, sliderYear) {
    if (sliderYear === undefined) {
        sliderYear = $('#slider').slider("value");
    }

    return d.values.filter(function (data) {
        return data.Year === sliderYear;
    })[0].Connectivity;
}

function dataInit(data) {
    linePlotXScale.domain(d3.extent(data, function (d) {
        return d["Year"];
    }));
    linePlotYScale.domain([0, 100]);


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

    // Calculate diff Values
    allCountries.forEach(function (d) {
        d.diffValues = [];
        for (var i = 0; i < d.values.length - 1; i++) {
            d.diffValues[i] = {
                Year: d.values[i + 1].Year,
                diffConnectivity: (d.values[i + 1].Connectivity - d.values[i].Connectivity)
            };
        }
    });

    var max = d3.max(allCountries, function (d) {
        return d3.max(d.diffValues, function (d) {
            return d.diffConnectivity;
        });
    });
    var min = d3.min(allCountries, function (d) {
        return d3.min(d.diffValues, function (d) {
            return d.diffConnectivity;
        });
    });
    diffLinePlotXScale.domain(d3.extent(allCountries[0].diffValues, function (d) {
        return d.Year;
    }));
    diffLinePlotYScale.domain([min, max]);

    allCountries.sort(function (a, b) {
        return d3.descending(a.id, b.id);
    });


    // SORTING
    d3.select("#cbSortValues").on("change", change);

    function change() {
        var yearStart, yearEnd, sortValue
        if (mode === MODE_DEFAULT) {
            yearStart = $('#slider').slider("value");
            sortValue = function (a, b) {
                return getCurrentConnectivity(a, yearStart) - getCurrentConnectivity(b, yearStart);
            };
        } else if (mode === MODE_DIFF) {
            yearStart = $('#slider').slider("values", 0);
            yearEnd = $('#slider').slider("values", 1);
            sortValue = function (a, b) {
                return (getCurrentConnectivity(a, yearEnd) - getCurrentConnectivity(a, yearStart)) -
                        (getCurrentConnectivity(b, yearEnd) - getCurrentConnectivity(b, yearStart));
            };
        }

        //getCurrentConnectivity(d, yearEnd) - getCurrentConnectivity(d, yearStart)

        // Copy-on-write since tweens are evaluated after a delay.
        var y0 = barChartYScale.domain(allCountries.sort(this.checked
                ? sortValue
                : function (a, b) {
                    return d3.descending(a.id, b.id);
                })
                .map(function (d) {
                    return d.id;
                }))
                .copy();

        barChartG.selectAll(".bar")
                .sort(function (a, b) {
                    return y0(b.id) - y0(a.id);
                });

        var transition = barChartG.transition().duration(250),
                delay = function (d, i) {
                    return i * 5;
                };

        transition.selectAll(".bar")
                .delay(delay)
                .attr("y", function (d) {
                    return y0(d.id);
                });

        transition.select(".y.axis")
                .call(barChartYAxis)
                .selectAll("g")
                .delay(delay);
    }


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

queue()
        .defer(d3.csv, 'connectivity.csv')
        .await(uponLoad);

function uponLoad(error, result) {
    if (error) {
        console.log("error: " + error);
    } else {
        result.forEach(type);
        dataInit(result);
        updateBarChart();

        //checkIDs();
    }

}

function checkIDs() {
    var DatamapObjects = Datamap.prototype.worldTopo.objects.world.geometries.slice();
    DatamapObjects.sort(function (a, b) {
        return d3.ascending(a.properties.name, b.properties.name);
    });

    DatamapObjects.forEach(
            function (d, i) {
                console.log(d.properties.name + " -> " + d.id);
            });
}

