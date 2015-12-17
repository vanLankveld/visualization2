//This is executed as soon as the page's html is loaded:
$(document).ready(function () {

    //Determine the dimensions of the diagram, this should be equal to the dimenions of the 'main-view' element
    var mainView = $('#main-view');
    var width = mainView.width();
    var height = mainView.height();

    //Create 100 random vertices:
    var vertices = d3.range(100).map(function (d) {
        return [Math.random() * width, Math.random() * height];
    });

    //initialize voronoi geometry using d3 and the specified width and height
    var voronoi = d3.geom.voronoi()
            .clipExtent([[0, 0], [width, height]]);

    //Put create an svg element for the diagram and append this to the #main-view element 
    var svg = d3.select("#main-view").append("svg")
            .attr("width", width)
            .attr("height", height)
            .on("mousemove", function () {
                vertices[0] = d3.mouse(this);
                redraw();
            });

    var path = svg.append("g").selectAll("path");
    
    svg.selectAll("circle")
            .data(vertices.slice(1))
            .enter().append("circle")
            .attr("transform", function (d) {
                return "translate(" + d + ")";
            })
            .attr("r", 1.5);

    redraw();

    function redraw() {
        path = path
                .data(voronoi(vertices), polygon);

        path.exit().remove();

        path.enter().append("path")
                .attr("class", function (d, i) {
                    return "q" + (i % 9) + "-9";
                })
                .attr("d", polygon);

        path.order();
    }

    function polygon(d) {
        return "M" + d.join("L") + "Z";
    }
});


