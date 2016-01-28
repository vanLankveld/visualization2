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
        .domain([20, 40, 60, 80])
        .range(["#eff3ff", "#bdd7e7", "#6baed6", "#3182bd", "#08519c"]);
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
// Variables for plots and such
// Line Plot
var linePlotOuterWIdth;
var linePlotOuterHeight;
var linePlotMargin;
var linePlotInnerWidth;
var linePlotInnerHeight;
var outerLinePlotSvg = d3.select('#linePlot').append('svg')
        .attr('width', linePlotOuterWIdth)
        .attr('height', linePlotOuterHeight);
var linePlotG;
var linePlotXAxisG;
var linePlotYAxisG;
var linePlotXScale = d3.scale.linear().range([0, linePlotInnerWidth]);
var linePlotYScale = d3.scale.linear().range([linePlotInnerHeight, 0]);
var linePlotXAxis;
var linePlotYAxis;
var linePlotLine = d3.svg.line()
        //.interpolate("basis")
        .defined(function (d) {
            return d.Connectivity !== null;
        })
        .x(function (d) {
            return linePlotXScale(d.Year);
        })
        .y(function (d) {
            return linePlotYScale(d.Connectivity);
        });
// diffLine Plot
var diffLinePlotOuterWIdth;
var diffLinePlotOuterHeight;
var diffLinePlotMargin;
var diffLinePlotInnerWidth;
var diffLinePlotInnerHeight;
var outerDiffLinePlotSvg = d3.select('#diffLinePlot').append('svg')
        .attr('width', diffLinePlotOuterWIdth)
        .attr('height', diffLinePlotOuterHeight);
var diffLinePlotG;
var diffLinePlotXAxisG;
var diffLinePlotYAxisG;
var diffLinePlotXScale = d3.scale.linear().range([0, diffLinePlotInnerWidth]);
var diffLinePlotYScale = d3.scale.linear().range([diffLinePlotInnerHeight, 0]);
var diffLinePlotXAxis;
var diffLinePlotYAxis;
var diffLinePlotLine = d3.svg.line()
        //.interpolate("basis")
        .defined(function (d) {
            return d.diffConnectivity !== null;
        })
        .x(function (d) {
            return diffLinePlotXScale(d.Year);
        })
        .y(function (d) {
            return diffLinePlotYScale(d.diffConnectivity);
        });
// Bar chart
var barChartTitleSvg = d3.select('#titleSvgDiv').append('svg')
        .attr('width', barChartOuterWidth)
        .attr('height', barChartOuterHeight);
var barChartMargin;
var barChartOuterWidth;
var barChartOuterHeight;
var barChartInnerWidth;
var barChartInnerHeight;
var barChartYScale;
var barChartXScale;
var barChartXAxis;
var barChartYAxis;
var outerBarChartSvg = d3.select('#barChart').append('svg')
        .attr('width', barChartOuterWidth)
        .attr('height', barChartOuterHeight);
var barChartG;
var barChartXAxisSvg = d3.select('#barChartXAxis').append('svg')
        .attr('width', $('#barChartXAxis').width())
        .attr('height', Math.floor($('#barChartXAxis').height()));
var barChartXAxisG;
var barChartYAxisG;
// Legend
var legendSvg = d3.select('#divLegend').append('svg')
        .attr('width', 250)
        .attr('height', $('#divLegend').height());
var legendG;
var colorDomain = [];
var color = d3.scale.category10(); // set the colour scale 

// Tooltip
var toolTipDiv = d3.select("body").append("div")
        .attr("class", "datamaps-hoverover")
        .style("opacity", 0)
        .style("position", "absolute")
        .style("display", "block");
var toolTip = toolTipDiv.append("div")
        .attr("class", "hoverinfo");
///////////////////////////////// Funcions ////////////////////////////////////

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
var allCountriesSorted = null;
var selectedCountries = [];
var highlightedCountry = null;
$(document).ready(function () {
    mainView = $('#main-view');
    initGs();
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
            initGs();
            updateBarChart();
            updatePlot();
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
    $("#cbSortValues").button({
        position: {my: "right top", at: "right top", of: $('#barChartTitle')} // not working?
    });
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
        },
        resize: function (event, ui) {
            d3.select("#divLegend")
                    .attr("width", ui.size.width)
                    .attr("height", ui.size.height);
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
            popupTemplate: function (geography, data) { //this function should just return a string
                if (mode === MODE_DEFAULT) {
                    return '<div class="hoverinfo"><strong>' + geography.properties.name + '</strong> <br/>' + d3.round(getCurrentConnectivity(getDataByID(geography.id)), 1) + "%" + '</div>';
                } else if (mode === MODE_DIFF) {
                    var yearStart = $('#slider').slider("values", 0);
                    var yearEnd = $('#slider').slider("values", 1);
                    return '<div class="hoverinfo"><strong>' + geography.properties.name + '</strong> <br/>' + d3.round(getCurrentConnectivity(getDataByID(geography.id), yearEnd) - getCurrentConnectivity(getDataByID(geography.id), yearStart), 1) + "%" + '</div>';
                }
            },
            highlightOnHover: false
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
        $('#divMode').buttonset("option", "disabled", true);
        $('#slider').slider("option", "disabled", true);
    } else if (selectedCountries.length === 0 && barChart.style("display") === "none") {
        $("#linePlot").hide();
        $("#diffLinePlot").hide();
        $('#barChartTitle').show();
        $("#barChart").show();
        $('#barChartXAxis').show();
        $('#divMode').buttonset("option", "disabled", false);
        $('#slider').slider("option", "disabled", false);
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
    var selectedIndex = selectedCountryIndex(country);
    if (selectedIndex !== -1) {
        return color(country);
    }
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

function initGs() {
// Line Plot
    linePlotOuterWIdth = $('#linePlot').width();
    linePlotOuterHeight = $('#linePlot').height();
    linePlotMargin = {left: 50, top: 50, right: 50, bottom: 50};
    linePlotInnerWidth = linePlotOuterWIdth - linePlotMargin.left - linePlotMargin.right;
    linePlotInnerHeight = linePlotOuterHeight - linePlotMargin.top - linePlotMargin.bottom;
    outerLinePlotSvg
            .attr('width', linePlotOuterWIdth)
            .attr('height', linePlotOuterHeight);
    linePlotG = outerLinePlotSvg.append("g")
            .attr("transform", "translate(" + linePlotMargin.left + "," + linePlotMargin.top + ")");
    linePlotXAxisG = linePlotG.append("g")
            .attr("transform", "translate(0," + linePlotInnerHeight + ")");
    linePlotYAxisG = linePlotG.append("g");
    linePlotXScale.range([0, linePlotInnerWidth]);
    linePlotYScale.range([linePlotInnerHeight, 0]);
    linePlotXAxis = d3.svg.axis().scale(linePlotXScale).orient("bottom")
            .tickFormat(d3.format("04d")) // Use intelligent abbreviations, e.g. 5M for 5 Million
            .outerTickSize(0); // Turn off the marks at the end of the axis.
    linePlotYAxis = d3.svg.axis().scale(linePlotYScale).orient("left")
            .tickFormat(function (d) {
                return d + "%";
            })
            .ticks(5)                   // Use approximately 5 ticks marks.
            .outerTickSize(0); // Turn off the marks at the end of the axis.

// diffLine Plot
    diffLinePlotOuterWIdth = $('#diffLinePlot').width();
    diffLinePlotOuterHeight = $('#diffLinePlot').height();
    diffLinePlotMargin = {left: 50, top: 50, right: 50, bottom: 50};
    diffLinePlotInnerWidth = diffLinePlotOuterWIdth - diffLinePlotMargin.left - diffLinePlotMargin.right;
    diffLinePlotInnerHeight = diffLinePlotOuterHeight - diffLinePlotMargin.top - diffLinePlotMargin.bottom;
    outerDiffLinePlotSvg
            .attr('width', diffLinePlotOuterWIdth)
            .attr('height', diffLinePlotOuterHeight);
    diffLinePlotG = outerDiffLinePlotSvg.append("g")
            .attr("transform", "translate(" + diffLinePlotMargin.left + "," + diffLinePlotMargin.top + ")");
    diffLinePlotXAxisG = diffLinePlotG.append("g")
            .attr("transform", "translate(0," + diffLinePlotInnerHeight + ")");
    diffLinePlotYAxisG = diffLinePlotG.append("g");
    diffLinePlotXScale.range([0, diffLinePlotInnerWidth]);
    diffLinePlotYScale.range([diffLinePlotInnerHeight, 0]);
    diffLinePlotXAxis = d3.svg.axis().scale(diffLinePlotXScale).orient("bottom")
            .tickFormat(d3.format("04d")) // Use intelligent abbreviations, e.g. 5M for 5 Million
            .outerTickSize(0); // Turn off the marks at the end of the axis.
    diffLinePlotYAxis = d3.svg.axis().scale(diffLinePlotYScale).orient("left")
            .tickFormat(function (d) {
                return d + "%";
            })
            .ticks(5)                   // Use approximately 5 ticks marks.
            .outerTickSize(0); // Turn off the marks at the end of the axis.

// Legend
    legendSvg
            .attr('width', $('#divLegend').width())//-$('#divLegend').css('padding-left')-$('#divLegend').css('padding-right'))
            .attr('height', $('#divLegend').height()); //-$('#divLegend').css('padding-top')-$('#divLegend').css('padding-bottom'));
    legendG = legendSvg
            .append('g');
// Bar chart
    barChartMargin = {left: 100, top: 5, right: 50, bottom: 0};
    barChartOuterWidth = $('#barChart').width() - 2 * scrollbarWidth;
    barChartOuterHeight = 4 * $('#barChart').height();
    barChartInnerWidth = barChartOuterWidth - barChartMargin.left - barChartMargin.right;
    barChartInnerHeight = barChartOuterHeight - barChartMargin.top - barChartMargin.bottom;
    barChartYScale = d3.scale.ordinal()
            .rangeBands([barChartInnerHeight, 0], 0.1);
    barChartXScale = d3.scale.linear()
            .range([0, barChartInnerWidth]);
    barChartXAxis = d3.svg.axis()
            .scale(barChartXScale)
            .ticks(5)
            .tickFormat(function (d) {
                return d + "%";
            })
            .orient("bottom");
    barChartYAxis = d3.svg.axis()
            .scale(barChartYScale)
            .orient("left");
    barChartTitleSvg
            .attr('width', barChartOuterWidth * 0.8)
            .attr('height', $('#barChartTitle').height());
    outerBarChartSvg
            .attr('width', barChartOuterWidth)
            .attr('height', barChartOuterHeight);
    barChartG = outerBarChartSvg.append("g")
            .attr("transform", "translate(" + barChartMargin.left + "," + barChartMargin.top + ")");
    barChartXAxisSvg
            .attr('width', $('#barChartXAxis').width())
            .attr('height', Math.floor($('#barChartXAxis').height()));
    barChartXAxisG = barChartXAxisSvg
            .append("g")
            .attr("transform", "translate(" + barChartMargin.left + ",0)")
            .attr("class", "x axis");
    barChartYAxisG = barChartG.append("g")
            .attr("class", "y axis");
}

function updateBarChart(yearStart, yearEnd) {
    var title = barChartTitleSvg.selectAll(".title")
            .data([1]);
    title.enter().append("text")
            .attr("class", "title");
    title
            .attr("x", (barChartOuterWidth / 2))
            .attr("y", ($('#barChartTitle').height() / 2))
            .attr("text-anchor", "middle")
            .text(function (d) {
                if (mode === MODE_DEFAULT) {
                    return "Internet connectivity at selected year";
                } else {
                    return "Change in internet connectivity between selected years";
                }
            });
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
                toolTipDiv.transition()
                        .duration(200)
                        .style("opacity", .9)
                        .style("display", "block");
                toolTipDiv.style("left", (d3.event.pageX) + "px")
                        .style("top", (d3.event.pageY + 30) + "px");
                toolTip.html(function (h) {
                    if (mode === MODE_DEFAULT) {
                        return "<strong>" + d.id + "</strong><br/>" + d3.round(getCurrentConnectivity(d, yearStart), 1) + "%";
                    } else if (mode === MODE_DIFF) {
                        return "<strong>" + d.id + "</strong><br/>" + d3.round(getCurrentConnectivity(d, yearEnd) - getCurrentConnectivity(d, yearStart), 1) + "%";
                    }
                });
            })
            .on('mouseleave', function (d) {
                removeHighlight(d.id);
                toolTipDiv.transition()
                        .duration(500)
                        .style("display", "none")
                        .style("opacity", 0);
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

    var zeroBarChart = barChartG.selectAll(".zeroBar").data(mode === MODE_DIFF ? [1] : []);
    zeroBarChart.enter().append("line")
            .attr("class", "zeroBar");
    zeroBarChart
            .attr("x1", barChartXScale(0))
            .attr("y1", d3.extent(barChartYScale.range())[0])
            .attr("x2", barChartXScale(0))
            .attr("y2", d3.extent(barChartYScale.range())[1])
            .attr("stroke-width", 1)
            .attr("stroke", "#ddd");
    zeroBarChart.exit().remove();
    updateLegend();
}



function updatePlot() {
// Line Plot
    linePlotXAxisG.call(linePlotXAxis);
    linePlotYAxisG.call(linePlotYAxis);
    var title = linePlotG.selectAll(".title")
            .data([1]);
    title.enter().append("text")
            .attr("class", "title")
            .attr("x", (linePlotInnerWidth / 2))
            .attr("y", 0 - (linePlotMargin.top / 2))
            .attr("text-anchor", "middle")
            .text("Internet connectivity vs years");
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
// Focus
    var focus = linePlotG.selectAll(".focus")
            .data(selectedCountries);
    var focusEnter = focus.enter()
            .append('g')
            .attr("class", ".focus")
            .style("display", "none");
    focusEnter.append("circle")
            .attr("r", 4);
    focusEnter.append("text")
            .attr("x", 9)
            .attr("dy", ".35em");
    focusEnter.append("line")
            .attr("class", "xFocus")
            .attr("y1", linePlotYScale(linePlotYScale.domain()[0]) - 6)
            .attr("y2", linePlotYScale(linePlotYScale.domain()[0]) + 6);
    focus.select('circle')
            .style("fill", function (d, i) {
                return color(d.id);
            });
    focus.exit().remove();

    linePlotG.append("rect")
            .attr("class", "overlay")
            .attr("width", linePlotInnerWidth)
            .attr("height", linePlotInnerHeight)
            .on("mouseover", function () {
                focus.style("display", null);
            })
            .on("mouseout", function () {
                focus.style("display", "none");
            })
            .on("mousemove", mousemove);

    function mousemove() {
        var bisector = d3.bisector(function (d, x) {
            return d3.ascending(d.Year, x);
        }).left;
        var x0 = linePlotXScale.invert(d3.mouse(this)[0]),
                i = bisector(selectedCountries[0].values, x0),
                d0 = selectedCountries[0].values[i - 1],
                d1 = selectedCountries[0].values[i],
                ii = x0 - d0.Year > d1.Year - x0 ? i : i - 1;

        focus.select("circle").attr("transform", function (d) {
            return "translate(" + linePlotXScale(d.values[ii].Year) + "," + linePlotYScale(d.values[ii].Connectivity) + ")";
        })
                .style("display", function (d) {
                    return d.values[ii].Connectivity === null ? "none" : null;
                });


        focus.select("text").attr("transform", function (d) {
            return "translate(" + linePlotXScale(d.values[ii].Year) + "," + linePlotYScale(d.values[ii].Connectivity) + ")";
        })
                .text(function (d) {
                    return d3.round(d.values[ii].Connectivity, 1) + "%";
                })
                .style("display", function (d) {
                    return d.values[ii].Connectivity === null ? "none" : null;
                });

        focus.select("line").attr("transform", function (d) {
            return "translate(" + linePlotXScale(d.values[ii].Year) + ",0)";
        });
    }


// diffLine Plot
    diffLinePlotXAxisG.call(diffLinePlotXAxis);
    diffLinePlotYAxisG.call(diffLinePlotYAxis);
    var zeroDiffPlot = diffLinePlotG.selectAll(".zeroDiff").data([1]);
    zeroDiffPlot.enter().append("line")
            .attr("class", "zeroDiff");
    zeroDiffPlot
            .attr("x1", diffLinePlotXScale.range()[0])
            .attr("y1", diffLinePlotYScale(0))
            .attr("x2", diffLinePlotXScale.range()[1])
            .attr("y2", diffLinePlotYScale(0))
            .attr("stroke-width", 1)
            .attr("stroke", "#ddd");
    var titleDiff = diffLinePlotG.selectAll(".title")
            .data([1]);
    titleDiff.enter().append("text")
            .attr("class", "title")
            .attr("x", (diffLinePlotInnerWidth / 2))
            .attr("y", 0 - (diffLinePlotMargin.top / 2))
            .attr("text-anchor", "middle")
            .text("Internet connectivity difference vs years");
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
    // Focus
    var focusDiff = diffLinePlotG.selectAll(".focus")
            .data(selectedCountries);
    var focusDiffEnter = focusDiff.enter()
            .append('g')
            .attr("class", ".focus")
            .style("display", "none");
    focusDiffEnter.append("circle")
            .attr("r", 4);
    focusDiffEnter.append("text")
            .attr("x", 9)
            .attr("dy", ".35em");
    focusDiffEnter.append("line")
            .attr("class", "xFocus")
            .attr("y1", diffLinePlotYScale(diffLinePlotYScale.domain()[0]) - 6)
            .attr("y2", diffLinePlotYScale(diffLinePlotYScale.domain()[0]) + 6);
    focusDiff.select('circle')
            .style("fill", function (d, i) {
                return color(d.id);
            });
    focusDiff.exit().remove();
    diffLinePlotG.append("rect")
            .attr("class", "overlay")
            .attr("width", diffLinePlotInnerWidth)
            .attr("height", diffLinePlotInnerHeight)
            .on("mouseover", function () {
                focusDiff.style("display", null);
            })
            .on("mouseout", function () {
                focusDiff.style("display", "none");
            })
            .on("mousemove", diffMousemove);
    function diffMousemove() {
        var bisector = d3.bisector(function (d, x) {
            return d3.ascending(d.Year, x);
        }).left;
        var x0 = diffLinePlotXScale.invert(d3.mouse(this)[0]),
                i = bisector(selectedCountries[0].diffValues, x0),
                d0 = selectedCountries[0].diffValues[i - 1],
                d1 = selectedCountries[0].diffValues[i],
                ii = x0 - d0.Year > d1.Year - x0 ? i : i - 1;
        focusDiff.select("circle").attr("transform", function (d) {
            return "translate(" + diffLinePlotXScale(d.diffValues[ii].Year) + "," + diffLinePlotYScale(d.diffValues[ii].diffConnectivity) + ")";
        })
                .style("display", function (d) {
                    return d.diffValues[ii].diffConnectivity === null ? "none" : null;
                });

        focusDiff.select("text").attr("transform", function (d) {
            return "translate(" + diffLinePlotXScale(d.diffValues[ii].Year) + "," + diffLinePlotYScale(d.diffValues[ii].diffConnectivity) + ")";
        }).text(function (d) {
            return d3.round(d.diffValues[ii].diffConnectivity, 1) + "%";
        })
                .style("display", function (d) {
                    return d.diffValues[ii].diffConnectivity === null ? "none" : null;
                });
        focusDiff.select("line").attr("transform", function (d) {
            return "translate(" + diffLinePlotXScale(d.diffValues[ii].Year) + ",0)";
        });
    }

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
                var offset = 0; //height * color.domain().length / 2;
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
                    return d;
                } else if (mode === MODE_DIFF) {
                    return d;
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
                    var text,
                            extent = defaultColorBins.invertExtent(d);
                    if (extent[0] === undefined) {
                        text = "< " + extent[1] + "%";
                    } else if (extent[1] === undefined) {
                        text = "> " + extent[0] + "%";
                    } else {
                        text = extent[0] + "% - " + extent[1] + "%";
                    }
                    return text;
                } else if (mode === MODE_DIFF) {
                    var text,
                            extent = diffColorBins.invertExtent(d);
                    if (extent[0] === undefined) {
                        text = "< " + extent[1] + "%";
                    } else if (extent[1] === undefined) {
                        text = "> " + extent[0] + "%";
                    } else {
                        text = extent[0] + "% - " + extent[1] + "%";
                    }
                    return text;
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

function getDataByID(id) {
    return allCountries.filter(function (country) {
        return country.id === id;
    })[0];
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
                return {Year: d.Year, Connectivity: d[country]};
            })
        };
    });
    // Calculate diff Values
    allCountries.forEach(function (d) {
        d.diffValues = [];
        for (var i = 0; i < d.values.length - 1; i++) {
            d.diffValues[i] = {
                Year: d.values[i + 1].Year,
                diffConnectivity: d.values[i + 1].Connectivity === null || d.values[i].Connectivity === null ? null : (d.values[i + 1].Connectivity - d.values[i].Connectivity)
            };
        }
    });
    allCountriesSorted = allCountries.slice().sort(function (a, b) {
        return d3.ascending(a.id, b.id);
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
            d[col] = d[col] === "" ? null : +d[col];
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
        //tryBisect();
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

function tryBisect() {

    var data = allCountries;
    data.sort(function (a, b) {
        return d3.ascending(a.id, b.id);
    });
    console.log(data);
    var bisector = d3.bisector(function (a, b) {
        return d3.ascending(a.id, b);
    }).left;
    var toFind = "NLD";
    console.log("Found " + toFind + " at index: " + bisector(data, toFind));
    return;
}
