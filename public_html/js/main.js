//This is executed as soon as the page's html is loaded:
var basic;

$(document).ready(function () {

    //Determine the dimensions of the diagram, this should be equal to the dimenions of the 'main-view' element
    var mainView = $('#main-view');
    var width = mainView.width();
    var height = mainView.height();

    basic = new Datamap({
        element: document.getElementById("main-view")
    });
});


