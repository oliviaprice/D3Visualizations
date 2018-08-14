function donutChart() {
    var data = [],
        width,
        height,
        margin = {top: 10, right: 10, bottom: 10, left: 10},
        colour = d3.scaleOrdinal(d3.schemeAccent), 
        variable, 
        category,
        padAngle, 
        transTime, 
        updateData,
        floatFormat = d3.format('.4r'),
        cornerRadius, 
        percentFormat = d3.format(',.2%');

    function chart(selection){
        selection.each(function() {
            // generate chart
            var radius = Math.min(width, height) / 2;

            // creates a new pie generator
            var pie = d3.pie()
                .value(function(d) { return floatFormat(d[variable]); })
                .sort(null);

            var arc = d3.arc()
                .outerRadius(radius * 0.8)
                .innerRadius(radius * 0.6)
                .cornerRadius(cornerRadius)
                .padAngle(padAngle);

            var outerArc = d3.arc()
                .outerRadius(radius * 0.9)
                .innerRadius(radius * 0.9);

            var svg = selection.append('svg')
                .attr('width', width + margin.left + margin.right)
                .attr('height', height + margin.top + margin.bottom)
              .append('g')
                .attr('transform', 'translate(' + width / 2 + ',' + height / 2 + ')');

            svg.append('g').attr('class', 'slices');
            svg.append('g').attr('class', 'labelName');
            svg.append('g').attr('class', 'lines');

            var path = svg.select('.slices')
                .selectAll('path')
                .data(pie(data))
              .enter().append('path')
                .attr('fill', function(d) { return colour(d.data[category]); })
                .attr('d', arc);

            var label = svg.select('.labelName').selectAll('text')
                .data(pie(data))
              .enter().append('text')
                .attr('dy', '.35em')
                .html(updateLabelText)
                .attr('transform', labelTransform)
                .style('text-anchor', function(d) {
                    // if slice centre is on the left, anchor text to start, otherwise anchor to end
                    return (midAngle(d)) < Math.PI ? 'start' : 'end';
                });

            var polyline = svg.select('.lines')
                .selectAll('polyline')
                .data(pie(data))
              .enter().append('polyline')
                .attr('points', calculatePoints);

            d3.selectAll('.labelName text, .slices path').call(toolTip);

            // FUNCTION TO UPDATE CHART
            updateData = function() {

                var updatePath = d3.select('.slices').selectAll('path');
                var updateLines = d3.select('.lines').selectAll('polyline');
                var updateLabels = d3.select('.labelName').selectAll('text');

                var data0 = path.data(), // store the current data before updating to the new
                    data1 = pie(data);


                updatePath = updatePath.data(data1, key);
                updateLines = updateLines.data(data1, key);
                updateLabels = updateLabels.data(data1, key);

                // adds new slices/lines/labels
                updatePath.enter().append('path')
                    .each(function(d, i) { this._current = findNeighborArc(i, data0, data1, key) || d; })
                    .attr('fill', function(d) {  return colour(d.data[category]); })
                    .attr('d', arc);

                updateLines.enter().append('polyline')
                    .each(function(d, i) { this._current = findNeighborArc(i, data0, data1, key) || d; })
                    .attr('points', calculatePoints);

                updateLabels.enter().append('text')
                    .each(function(d, i) { this._current = findNeighborArc(i, data0, data1, key) || d; })
                    .html(updateLabelText)
                    .attr('transform', labelTransform)
                    .style('text-anchor', function(d) { return (midAngle(d)) < Math.PI ? 'start' : 'end'; });


                updatePath.exit()
                    .transition()
                    .duration(transTime)
                    .attrTween("d", arcTween)
                    .remove();

                updateLines.exit()
                    .transition()
                    .duration(transTime)
                    .attrTween("points", pointTween)
                    .remove();

                updateLabels.exit()
                    .remove();

                // animates the transition from old angle to new angle for slices/lines/labels
                updatePath.transition().duration(transTime)
                    .attrTween('d', arcTween);

                updateLines.transition().duration(transTime)
                    .attrTween('points', pointTween);

                updateLabels.transition().duration(transTime)
                    .attrTween('transform', labelTween)
                    .styleTween('text-anchor', labelStyleTween);

                updateLabels.html(updateLabelText); // update the label text

                // add tooltip to mouse events on slices and labels
                d3.selectAll('.labelName text, .slices path').call(toolTip);

            };

            function midAngle(d) { return d.startAngle + (d.endAngle - d.startAngle) / 2; }

            // function that creates and adds the tool tip to a selected element
            function toolTip(selection) {

                // add tooltip (svg circle element) when mouse enters label or slice
                selection.on('mouseenter', function (data) {

                    svg.append('text')
                        .attr('class', 'toolCircle')
                        .attr('dy', -15) // hard-coded. can adjust this to adjust text vertical alignment in tooltip
                        .html(toolTipHTML(data)) // add text to the circle.
                        .style('font-size', '.7em')
                        .style('text-anchor', 'middle'); // centres text in tooltip

                    svg.append('circle')
                        .attr('class', 'toolCircle')
                        .attr('r', radius * 0.55) // radius of tooltip circle
                        .style('fill', colour(data.data[category])) // colour based on category mouse is over
                        .style('fill-opacity', 0.35);

                });

                // remove the tooltip when mouse leaves the slice/label
                selection.on('mouseout', function () {
                    d3.selectAll('.toolCircle').remove();
                });
            }

            // function to create the HTML string for the tool tip. Loops through each key in data object
            // and returns the html string key: value
            function toolTipHTML(data) {

                var tip = '',
                    i   = 0;

                for (var key in data.data) {

                    // if value is a number, format it as a percentage
                    var value = (!isNaN(parseFloat(data.data[key]))) ? percentFormat(data.data[key]) : data.data[key];

                    // leave off 'dy' attr for first tspan so the 'dy' attr on text element works. The 'dy' attr on
                    // tspan effectively imitates a line break.
                    if (i === 0) tip += '<tspan x="0">' + key + ': ' + value + '</tspan>';
                    else tip += '<tspan x="0" dy="1.2em">' + key + ': ' + value + '</tspan>';
                    i++;
                }

                return tip;
            }

            // calculate the points for the polyline to pass through
            function calculatePoints(d) {
                // see label transform function for explanations of these three lines.
                var pos = outerArc.centroid(d);
                pos[0] = radius * 0.95 * (midAngle(d) < Math.PI ? 1 : -1);
                return [arc.centroid(d), outerArc.centroid(d), pos]
            }

            function labelTransform(d) {

                var pos = outerArc.centroid(d);

                // changes the point to be on left or right depending on where label is.
                pos[0] = radius * 0.95 * (midAngle(d) < Math.PI ? 1 : -1);
                return 'translate(' + pos + ')';
            }

            function updateLabelText(d) {
                return d.data[category] + ': <tspan>' + percentFormat(d.data[variable]) + '</tspan>';
            }

            // function that calculates transition path for label and also it's text anchoring
            function labelStyleTween(d) {
                this._current = this._current || d;
                var interpolate = d3.interpolate(this._current, d);
                this._current = interpolate(0);
                return function(t){
                    var d2 = interpolate(t);
                    return midAngle(d2) < Math.PI ? 'start':'end';
                };
            }

            function labelTween(d) {
                this._current = this._current || d;
                var interpolate = d3.interpolate(this._current, d);
                this._current = interpolate(0);
                return function(t){
                    var d2  = interpolate(t),
                        pos = outerArc.centroid(d2); // computes the midpoint [x,y] of the centre line that would be
                    // generated by the given arguments. It is defined as startangle + endangle/2 and innerR + outerR/2
                    pos[0] = radius * (midAngle(d2) < Math.PI ? 1 : -1); // aligns the labels on the sides
                    return 'translate(' + pos + ')';
                };
            }

            function pointTween(d) {
                this._current = this._current || d;
                var interpolate = d3.interpolate(this._current, d);
                this._current = interpolate(0);
                return function(t){
                    var d2  = interpolate(t),
                        pos = outerArc.centroid(d2);
                    pos[0] = radius * 0.95 * (midAngle(d2) < Math.PI ? 1 : -1);
                    return [arc.centroid(d2), outerArc.centroid(d2), pos];
                };
            }

            function arcTween(d) {
                var i = d3.interpolate(this._current, d);
                this._current = i(0);
                return function(t) { return arc(i(t)); };
            }

            function findNeighborArc(i, data0, data1, key) {
                var d;
                return (d = findPreceding(i, data0, data1, key)) ? {startAngle: d.endAngle, endAngle: d.endAngle}
                    : (d = findFollowing(i, data0, data1, key)) ? {startAngle: d.startAngle, endAngle: d.startAngle}
                        : null;
            }
            // Find the element in data0 that joins the highest preceding element in data1.
            function findPreceding(i, data0, data1, key) {
                var m = data0.length;
                while (--i >= 0) {
                    var k = key(data1[i]);
                    for (var j = 0; j < m; ++j) {
                        if (key(data0[j]) === k) return data0[j];
                    }
                }
            }

            function key(d) {
                return d.data[category];
            }

            // Find the element in data0 that joins the lowest following element in data1.
            function findFollowing(i, data0, data1, key) {
                var n = data1.length, m = data0.length;
                while (++i < n) {
                    var k = key(data1[i]);
                    for (var j = 0; j < m; ++j) {
                        if (key(data0[j]) === k) return data0[j];
                    }
                }
            }

            // ===========================================================================================

        });
    }

    chart.width = function(value) {
        if (!arguments.length) return width;
        width = value;
        return chart;
    };

    chart.height = function(value) {
        if (!arguments.length) return height;
        height = value;
        return chart;
    };

    chart.margin = function(value) {
        if (!arguments.length) return margin;
        margin = value;
        return chart;
    };

    chart.radius = function(value) {
        if (!arguments.length) return radius;
        radius = value;
        return chart;
    };

    chart.padAngle = function(value) {
        if (!arguments.length) return padAngle;
        padAngle = value;
        return chart;
    };

    chart.cornerRadius = function(value) {
        if (!arguments.length) return cornerRadius;
        cornerRadius = value;
        return chart;
    };

    chart.colour = function(value) {
        if (!arguments.length) return colour;
        colour = value;
        return chart;
    };

    chart.variable = function(value) {
        if (!arguments.length) return variable;
        variable = value;
        return chart;
    };

    chart.category = function(value) {
        if (!arguments.length) return category;
        category = value;
        return chart;
    };

    chart.transTime = function(value) {
        if (!arguments.length) return transTime;
        transTime = value;
        return chart;
    };

    chart.data = function(value) {
        if (!arguments.length) return data;
        data = value;
        if (typeof updateData === 'function') updateData();
        return chart;
    };

    return chart;
}
