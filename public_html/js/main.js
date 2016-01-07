var INTERACTION_SELECT = "select";
var INTERACTION_ZOOMIN = "zoom-in";
var INTERACTION_ZOOMOUT = "zoom-out";

var mainView;
var worldMap = null;
var csv;
var afterResizeId = 0;

var interactionMode = INTERACTION_SELECT;

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
    
    setZoomEvents();
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
    }
    mainView.css('cursor', cursor);
}

function setZoomEvents() {
    $('#main-view *').click(function (e) {
        var parentOffset = mainView.offset();
        var zoomX = e.pageX - parentOffset.left;
        var zoomY = e.pageY - parentOffset.top;

        if (interactionMode === INTERACTION_ZOOMIN) {
            zoomIn(zoomX, zoomY);
        }
    });
}

function zoomIn(zoomX, zoomY) {
    
}