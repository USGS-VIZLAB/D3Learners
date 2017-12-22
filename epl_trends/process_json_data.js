// function to combine EPL json data
// json data from https://github.com/jokecamp/FootballData/tree/master/EPL%201992%20-%202015/tables
// years 1992 to 2015

function load_data() {

	var seasons = ["92-93","93-94","94-95","95-96","96-97","97-98",
			   "98-99","99-00","00-01","01-02","02-03","03-04",
			   "04-05","05-06","06-07","07-08","08-09","09-10",
			   "10-11","11-12","12-13","13-14","14-15"];
	//"https://raw.githubusercontent.com/jokecamp/FootballData/master/EPL%201992%20-%202015/tables/epl-92-93.json"
	var baseurl = "https://raw.githubusercontent.com/jokecamp/FootballData/master/EPL%201992%20-%202015/tables/epl";
	var q = d3.queue();
	seasons.forEach(function(s) {
		url = baseurl + "-" + s + ".json";
		q.defer(parseEPLJson, url, s);
	});

	q.await(combineData);
	
}

// custom function to read json files and add the seasons to the json data
function parseEPLJson(url, season, callback) {
	d3.json(url, function(data) {
		data.forEach(function(d) {
			d.season = season;
			d["goals-dff"] = parseFloat(d["goals-dff"]); //parseFloat for handling negative values
			// keep only the first season and convert to year
				var yr1 = season.match(/[0-9]{2}-*/)[0]; // "12-13" = "12-"
				d.startyear = d3.timeParse("%y")(yr1.replace("-","")).getFullYear();
		});
		callback(null, data); // CALLBACK MUST BE INSIDE d3.json --- VERY IMPORTANT. This is what tells d3.defer what to return when it is ready
	});
}

// function to ultimately use all the queued up json files
function combineData(error, seasons) {
	// arguments is used to account for all objects, especially useful for unknown number of objects
	// From learnjsdata.com/read_data.html: "The callback function passed into await gets each dataset 
	// as a parameter, with the first parameter being populated if an error has occurred in loading the data."

	// arguments[0] is the error
	error = arguments[0];
	
	// the rest of the indices of arguments are all the other arguments passed in
	// so in this case, all of the results from q.defers
	var allJsonArrays = Array.prototype.slice.call(arguments); // convert arguments to a normal array
	allJsonArrays.splice(0,1); // chop off the error part of arguments so you are left w. just the q.defer results
	allJsonArrays.forEach(function(d, i) {
		var current_season = seasons[i];
	})

	var merged_data = d3.merge(allJsonArrays);

	merged_data.sort(function(a, b) { 
		return d3.ascending(a.startyear, b.startyear); 
	});
	
	// this is where you put code to use merged_data!!!!!!!!!!!!!!!!!!!!!!
	var yvar = document.getElementById("yaxis").value.toLowerCase();
	plotarea = setupPlot(plotarea, merged_data, yvar);

	d3.select("form").on("change", function(d) {
		
        var new_yvar = document.getElementById("yaxis").value.toLowerCase();
        if(new_yvar == "goal differential") {
        	new_yvar = "goals-dff";
        }

        plotarea = updatePlot(plotarea, merged_data, new_yvar);
		
		//by default html form submissions does a full page refresh, this turns that off
    	d3.event.preventDefault(); 
    });

}

function setupPlot(plot, data, yvar) {
	
	// add to scaling functions based on data
	var ymax = d3.max(data, function(d) { return d[yvar]; })
		uniqueyears = d3.map(data, function(d){ return d.startyear; }).keys()
		uniqueteams = d3.map(data, function(d){ return d.team; }).keys();
	xScale.domain(uniqueyears); 
	yScale.domain([1, ymax]); //axes inverted to start for "Rank"
	colorScale.domain(uniqueteams);

	// add grid lines (before axes so that axes are plotted over top)
	gridDetails.append("g")
		.classed('xgrid gridlines', true)
		.call(make_x_gridlines);
	gridDetails.append("g")
		.classed('ygrid gridlines', true)
		.call(make_y_gridlines);

	// add axes
	axesDetails.append("g")
          .classed("x-axis", true)
		  .attr("transform", "translate(" + 0 + "," + plotheight + ")")
          .call(xAxis);
    axesDetails.append("g")
          .classed("y-axis", true)
		  .call(yAxis);
		
	 // setup line function
	 var buildLine = d3.line()//.curve(d3.curveCardinal)
	 		.defined(function(d, i, j) { // j allows you too look forward and backward on whole data
				if(i == 0){
					return true;
				} else {
					var prev = j[i-1];
					var future = j[i+1];
					var diff = d.startyear - prev.startyear;
					return diff == 1;
				}
			})
			.x(function(d) { return xScale(d.startyear); })
			.y(function(d) { return yScale(d[yvar]); });
	
	// setup line function
	var buildGapLine = d3.line()//.curve(d3.curveCardinal)
		// .defined(function(d, i, j) { // j allows you too look forward and backward on whole data
		// 		if(i == 0){
		// 			return false;
		// 		} else {
		// 			var prev = j[i-1];
		// 			var future = j[i+1];
		// 			var diff = d.startyear - prev.startyear;
		// 			return diff !== 1;
		// 		}
		// })
		.x(function(d) { return xScale(d.startyear); })
		.y(function(d) { return yScale(d[yvar]); });

	// organize data by team
	var databyteam = d3.nest()
    	.key(function(d) { return d.team; })
		.entries(data);
    
	// add points
	var pts_g = plot.append("g");
	pts_g.selectAll(".datapt")
		.data(data)
		.enter()
		.append("circle")
		.attr("class", "datapt")
		.attr("r", 3)
		.attr("cx", function(d) { return xScale(d.startyear); })
		.attr("cy", function(d) { return yScale(d[yvar]); })
		.style("fill", function(d) { return colorScale(d.team); });	
	
	// add line styled for gaps
	var gaps_g = plot.append("g");
	gaps_g.selectAll(".teamlinegaps")
		.data(databyteam)
		.enter()
  		.append("path")
		.attr("class", "teamlinegaps")
		.attr("d", function(d) { return buildGapLine(d.values); })
		.style("stroke", function(d) { return colorScale(d.key); })
		.style("stroke-dasharray", "3,3")
		.style("fill", "none");

	// add lines overtop of gaps
	var lines_g = plot.append("g");
	lines_g.selectAll(".teamline")
		.data(databyteam)
		.enter()
  		.append("path")
		.attr("class", "teamline")
		.attr("d", function(d) { return buildLine(d.values); })
		.style("stroke", function(d) { return colorScale(d.key); })
		.style("fill", "none");
		
	var hoverlines_g = plot.append("g");
	hoverlines_g.selectAll(".teamlineinvisible")
		.data(databyteam)
		.enter()
		.append("path")
		.attr("class", "teamlineinvisible")
		.attr("d", function(d) { return buildLine(d.values); })
		.style('stroke-width', "10px")
		.style('stroke', 'transparent')
		.style("fill", "none");

	// update phase????
	hoverlines_g.selectAll(".teamlineinvisible")
		.on("mouseover", function(d) {
			//var this_color = d3.select(this).style("stroke");
			//d3.selectAll(".teamline").style("stroke", "grey");
			//d3.select(this).style("stroke", this_color);
			d3.select(this).style('stroke-width', "6px")
				.style("stroke", function(d) { return colorScale(d.key); });			// determine location of mouse
			var x_val = d3.event.pageX; //xScale(d.startyear); //
			var y_val = d3.event.pageY; //yScale(d[yvar]); //
			// add text element
			d3.select("#tooltip")
				.style("display", "block")
				.style("position", "absolute")
				.style("left", x_val+"px")
				.style("top", y_val+"px")
				.style("pointer-events", "none")
				.select("#teamName")
				.text(d.key);

		})
		.on("mouseout", function(d,i) {
			d3.select(this)
				.style('stroke-width', "10px")
				.style('stroke', 'transparent');
			d3.selectAll("#tooltip")
				.style("display", "none")
				.style("pointer-events", "none");
		})

	return plot;
}

function updatePlot(plot, data, yvar) {

	// add to scaling functions based on data
	var uniqueyears = d3.map(data, function(d){ return d.startyear; }).keys()
		uniqueteams = d3.map(data, function(d){ return d.team; }).keys();
	xScale.domain(uniqueyears); 

	// ymin and ymax vary based on the type of data
	// defaults for "Rank" are inverted
	var ymin = d3.max(data, function(d) { return d[yvar]; }),
		ymax = 1;
	if(yvar == "goals-dff") {
		ymin = d3.min(data, function(d) { return d[yvar]; });
		ymax = d3.max(data, function(d) { return d[yvar]; });
	} else if(yvar.match(/^(losses|draws|wins)$/)){
		ymin = 0;
		ymax = d3.max(data, function(d) { return d[yvar]; });
	}

	yScale.domain([ymax, ymin]);
	colorScale.domain(uniqueteams);
		  
	// add grid lines (before axes so that axes are plotted over top)
	plot.select(".xgrid")
		.transition()
		.duration(duration_time)
	 	.call(make_x_gridlines);
	plot.select(".ygrid")
		.transition()
		.duration(duration_time)
		.call(make_y_gridlines);

	plot.select(".x-axis")
          .transition()
          .duration(duration_time)
          .call(xAxis);
	plot.select(".y-axis")
          .transition()
          .duration(duration_time)
		  .call(yAxis);

	plot.select(".x-axis .y-axis").exit().remove();

	// setup line function
	var buildLine = d3.line()//.curve(d3.curveCardinal)
			.x(function(d) { return xScale(d.startyear); })
			.y(function(d) { return yScale(d[yvar]); });

	// organize data by team
	var databyteam = d3.nest()
    	.key(function(d) { return d.team; })
    	.entries(data);

	plot.selectAll(".datapt")
		.data(data)
		.transition()
		.duration(duration_time)
		//.delay(function(d, i) { return i * 10; })
		.attr("r", 3)
		.attr("cx", function(d) { return xScale(d.startyear); })
		.attr("cy", function(d) { return yScale(d[yvar]); })
		.style("fill", function(d) { return colorScale(d.team); });	

	plot.selectAll(".teamline")
		.data(databyteam)  
		.transition()
		.duration(duration_time)
		.delay(function(d, i) { return i * 10; })
		.attr("d", function(d) { return buildLine(d.values); })
		.style("stroke", function(d) { return colorScale(d.key); })
		.style("fill", "none");

	plot.selectAll(".teamlineinvisible")
		.data(databyteam)
		.attr("class", "teamlineinvisible")
		.attr("d", function(d) { return buildLine(d.values); })
		.style('stroke-width', "10px")
		.style('stroke', 'transparent')
		.style("fill", "none");

	plot.selectAll(".datapt").exit().remove();
	plot.selectAll(".teamline").exit().remove();
	plot.selectAll(".teamlineinvisible").exit().remove();

	return plot;
}
