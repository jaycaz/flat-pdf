// var requirejs = require('requirejs')
var pdfjs = require('pdfjs-dist');
var d3 = require('d3');
var $ = require('jquery');
// var jui = require('jquery-ui');
var slider = require('d3-slider');


var pages = [];
var npages = 0;
var currPage = 0;

// Global variables for page dimensions
// I know this is probably not the JS way to do it, sue me
var PAGE_WIDTH = 25;
var PAGE_HEIGHT = 37;
var PAGE_SHIFT_X = 30;
var PAGE_SHIFT_Y = 50;
var PAGES_PER_COL = 30;
var FULL_PAGE_WIDTH = 820;
var FULL_PAGE_HEIGHT = 1060;

var svg = d3.select("#viz")
  .append("svg")
  .attr("width", "100%")
  .attr("height", "100%")
  .style("padding", "10px");

var npageHandle = $('#npage-handle');
var npageSlider = d3.select('#npage-slider')
  .call(slider()
  .axis(true)
  .min(1)
  .max(1000)
  .on("slide", function(evt, value)
    {
      npageHandle.text(value);
      setNpages(value);
      // $('#currpage-slider').max = npages;
      update();
    }));

var currpageHandle = $('#currpage-handle');
var currpageSlider = d3.select('#currpage-slider')
  .call(slider()
  .axis(true)
  .min(1)
  .max(1000)
  .on("slide", function(evt, value)
    {
      currpageHandle.text(value);
      currPage = value;
      update();
    }));

// $(function() {
//   var handle = $("#npage-handle");
//   $("#npage-slider").slider({
//     min: 1,
//     max: 1000,
//     create: function() {
//       handle.text($(this).slider("value"));
//       setNpages($(this).slider("value"));
//       update();
//     },
//     slide: function(event, ui) {
//       handle.text(ui.value);
//       setNpages(ui.value);
//       // $('#currpage-slider').max = npages;
//       update();
//     }
//   });
// });

// $(function() {
//   var handle = $("#currpage-handle");
//   $("#currpage-slider").slider({
//     min: 1,
//     max: 1000,
//     create: function() {
//       handle.text($(this).slider("value"));
//       currPage = $(this).slider("value");
//       update();
//     },
//     slide: function(event, ui) {
//       handle.text(ui.value);
//       currPage = ui.value;
//       update();
//     }
//   });
// });

function setNpages(n)
{
  // Depending on new value of npages, push/pop new pages to end
  if(n > npages)
  {
    for(var i = 0; i < (n-npages); i++)
    {
      pages.push({})
    }
  }
  else if(n < npages)
  {
    for(var i = 0; i < (npages-n); i++)
    {
      pages.pop();
    }
  }
  npages = n;
}

// Get position and dimensions of pages.
// depends on which page is currently open
function getPageX(d,i)
{
  x = parseInt(i / PAGES_PER_COL) * PAGE_SHIFT_X;
  if(i+1 < currPage)
    return x;
  else if (i+1 == currPage)
    return x + 2 * PAGE_SHIFT_X;
  else
    return x + 3 * PAGE_SHIFT_X + FULL_PAGE_WIDTH;
}

function getPageY(d,i)
{
  if(i+1 == currPage)
    return 0;
  else
    return parseInt(i % PAGES_PER_COL) * PAGE_SHIFT_Y;
}

function getPageW(d,i)
{
  if(i+1 == currPage)
    return FULL_PAGE_WIDTH;
  else
    return PAGE_WIDTH;
}

function getPageH(d,i)
{
  if(i+1 == currPage)
    return FULL_PAGE_HEIGHT;
  else
    return PAGE_HEIGHT;
}

function update() {

  var selection = svg.selectAll('rect')
    .data(pages);

  selection.enter()
    .append('rect');

  selection
    .attr('x', getPageX)
    .attr('y', getPageY)
    .attr('width', getPageW)
    .attr('height', getPageH)
    .attr('rx', 2)
    .attr('ry', 2)
    .style('stroke', '#000')
    .style('fill', '#e2e3e3');

  selection.exit().remove();
}
var bb = svg.node().getBBox();

