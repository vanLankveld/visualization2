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

    createToolbar();
});

function renderWorldMap(renderColors) {

    if (worldMap) {
        d3.selectAll("svg > *").remove();
        $('#main-view').empty();
    }

    worldMap = new Datamap({
        element: document.getElementById("main-view"),
        responsize: true
    });

    if (renderColors) {
        inputColors($("#slider").slider("value"));
    }

    setMouseEvents();
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

    worldMap.updateChoropleth(JSON.parse(json));
}

function createToolbar() {
    $('.bt-select').button({
        icons: {
            primary: "ui-icon-arrowthick-1-nw"
        },
        text: false
    });

    $('.bt-zoom-in').button({
        icons: {
            primary: "ui-icon-zoomin"
        },
        text: false
    });

    $('.bt-zoom-out').button({
        icons: {
            primary: "ui-icon-zoomout"
        },
        text: false
    });
    
    $('.bt-pan').button({
        icons: {
            primary: "ui-icon-arrow-4"
        },
        text: false
    });

    $('#toolbar').buttonset();

    $('.interaction-el').change(function () {
        if ($(this).is(':checked')) {
            interactionMode = $(this).val();
            changeCursor();
        }
    });
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
    d3.select("#main-view *").on('mousedown', function () {
        var coordinates = [0, 0];
        coordinates = d3.mouse(this);
        dragStartX = coordinates[0];
        dragStartY = coordinates[1];
    });
    
    d3.select("#main-view *").on('mouseup', function () {
        dragStartX = -1;
        dragStartY = -1;
    });
    
    d3.select("#main-view *").on('click', function () {
        var coordinates = [0, 0];
        coordinates = d3.mouse(this);
        var x = coordinates[0];
        var y = coordinates[1];
        
        if (interactionMode === INTERACTION_ZOOMIN) {
            zoomIn(x, y);
        }
        else if (interactionMode === INTERACTION_ZOOMOUT) {
            zoomOut(x, y);
        }
    });
    
    d3.select("#main-view *").on('mouseover', function () {
        var coordinates = [0, 0];
        coordinates = d3.mouse(this);
        var x = coordinates[0];
        var y = coordinates[1];
        
        if (interactionMode === INTERACTION_PAN && dragStartX > -1 && dragStartY > -1) {
            d3.event.preventDefault();
            pan(x, y);
        }
    });
}

function zoomIn(zoomX, zoomY) {
    scale *= 2;
    translatedX = zoomX - zoomX/scale;
    translatedY = zoomY - zoomY/scale;
    d3.select("#main-view svg g")
            .transition()
            .duration(1000)
            .ease("in-out")
            .attr("transform", "scale("+scale+")translate(-" + (translatedX) + ", -" + (translatedY) + ")");
}

function zoomOut(zoomX, zoomY) {
    scale /= 2;
    translatedX = zoomX - zoomX/scale;
    translatedY = zoomX - zoomX/scale;
    if (scale <= 1) {
        scale = 1;
        translatedX = 0;
        translatedY = 0;
    }
    d3.select("#main-view svg g")
            .transition()
            .duration(1000)
            .ease("in-out")
            .attr("transform", "scale("+scale+")translate(-" + (translatedX) + ", -" + (translatedY) + ")");
}

function pan(panX, panY) {
    translatedX += panX - dragStartX;
    translatedY += panY - dragStartY;
    d3.select("#main-view svg g")
            .attr("transform", "scale("+scale+")translate(-" + (translatedX) + ", -" + (translatedY) + ")");
}