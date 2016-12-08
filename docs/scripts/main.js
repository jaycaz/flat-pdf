  var pdf;

var drop = d3.select('#pdf-dropzone');
drop.style('height', '100%');

Dropzone.options.pdfDropzone = {
  paramName: "file", // The name that will be used to transfer the file
  clickable: false,
  maxFilesize: 100, // MB
  dictDefaultMessage: "Upload any PDF to make it into a scroll",
  previewTemplate: '<div></div>',
  init: function() {
    this.on("dragenter", function(e) {drop.select('div').style('color', '#008ae6')});
    this.on("dragleave", function(e) {drop.select('div').style('color', null)});
    this.on("addedfile", function(e) {drop.select('div').style('color', null)});
  },
  accept: function(file, done) {
    var reader = new FileReader();
    reader.onloadstart = function(event) {
      console.log("loading");
    }

    reader.onload = function(event) {
      var contents = event.target.result,
          error    = event.target.error;

      if(error != null) {
        console.error("File could not be read, code: " + error.code);
      }
      // } else {
      //   console.log("Contents: " + contents);
      // }

      readPDF(new Uint8Array(contents));
      drop.style('height', 'auto');
    }
    reader.readAsArrayBuffer(file);
  }
};

// var data = new Uint8Array(fs.readFileSync('BillinghurstBookMarch2016.pdf'))
// PDFJS.getDocument(data).then(function (pdfDoc) {
//   console.log('Loaded pdf, number of pages: ' + pdfDoc.numPages);
// })


// Data
var pages = [];
var npages = 0;
var currPage = 0;
var previewPage = null;
var scrollY = 0;

// Cached values for convenience
var currRect;

// Global variables for page dimensions
// I know this is probably not the JS way to do it, sue me
var PAGE_WIDTH = 29;
var PAGE_HEIGHT = 37;
var PAGE_SHIFT_X = 40;
var PAGE_SHIFT_Y = 35;
var PAGES_PER_COL = 20;
var FULL_PAGE_WIDTH = 820;
var FULL_PAGE_HEIGHT = 1060;

var SCROLL_SENSITIVITY = 2.0;

// Create PDF canvas for placement
var canvas = d3.select("#viz")
  .append('div')
  .attr("id", "pdf-container")
  .style("position", "absolute")
  .style("left", "0")
  .style("top", "0")
  .style("display", "inline-block")
  .style("z-index", "1")
  .append("canvas")
  .attr("id", "pdf-canvas")
  .style("padding", "2px");

var svg = d3.select("#viz")
  .append("svg")
  .attr("id", "viz-svg")
  .attr("width", "200%")
  .attr("height", FULL_PAGE_HEIGHT)
  .style("padding", "10px")

// Mouse wheel will scroll current page, and eventually trigger a new page
d3.select('body')
  .on("wheel.zoom", function() {
    if(!pdf)
    {
      return;
    }
    dy = d3.event.wheelDeltaY * SCROLL_SENSITIVITY;
    scrollY += dy;
    if(scrollY < -FULL_PAGE_HEIGHT && currPage < npages-1)
    {
      scrollY = 0;
      currPage++;
    }
    if(scrollY > FULL_PAGE_HEIGHT && currPage > 0)
    {
      scrollY = 0;
      currPage--;
    }
    console.log('scrollY: ' + scrollY);
    update();
  });

// Handle reading in dropped PDF
function readPDF(data) {
  PDFJS.getDocument(data).then( function (doc) {
    console.log('Loaded pdf, number of pages: ' + doc.numPages);
    setNpages(doc.numPages);
    pdf = doc;
    generateThumbnails();
    currPage = 0;
    update();
  })
}

//   #pdf-container {
//     position: absolute;
//     left: 0;
//     top: 0;
//     display: inline-block;
//     z-index: 1;
// }
  // .attr("width", FULL_PAGE_WIDTH)
  // .attr("height", FULL_PAGE_HEIGHT);

// Scroll through all pages, render image, then save as thumbnail
function generateThumbnails()
{
    // Get image and store minified version of it
  console.log("Generating thumbnails...");
  for(var i = 0; i < npages; i++)
  {
    // Create dummy canvas to render onto
    var thumbCanvas = d3.select('#viz')
      .append('canvas')
      .attr('id', 'thumbnail-canvas-' + i)
      .style('position', 'absolute')
      .style('padding-left', "2px")
      .style('pointer-events', 'none');

    var c = document.getElementById('thumbnail-canvas-' + i);
    console.log('canvas: ' + c);
    pages[i].thumb = thumbCanvas;

    renderPage(i, c, {width: PAGE_WIDTH, height: PAGE_HEIGHT, scrollY:0}, function(i) {
        pages[i].img = c.toDataURL();
        // console.log("Img[" + i + "]: " + pages[i].img);

        // Adjust image for better clarity at small scales
        Caman('#thumbnail-canvas-'+i, function() {
          this.exposure(50);
          this.saturation(75);
          this.render();
        });
      });
  }
}

// Render page number p on a particular canvas with particular dimensions {width, height}
function renderPage(p, canvas, dims, afterRendered)
{
  pdf.getPage(p+1) // Pages are one-indexed in PDFJS
  .then(function (page) {

    //Resize PDF viewport to fit canvas
    //TODO: Make the border not a magic number
    var viewport = page.getViewport(1);
    sw = (dims.width - 4) / viewport.width;
    sh = (dims.height - 4) / viewport.height;
    viewport = page.getViewport(Math.min(sw,sh));

    // TODO: Work with d3 selections instead of jquery, i.e. canvas.attr?
    canvas.height = viewport.height
    canvas.width = viewport.width;
    var context = canvas.getContext('2d');
    // context.clearRect(0, 0, canvas.width, canvas.height);
    context. setTransform(1, 0, 0, 1, 0, 0);
    context.translate(0, dims.scrollY);
    var pageTimestamp = new Date().getTime();
    var timestamp = pageTimestamp;
    var renderContext = {
      canvasContext: context,
      viewport: viewport
      // continueCallback: function(cont) {
      //   if(timestamp != pageTimestamp) {
      //     return;
      //   }
      //   cont();
      // }
    };
    var render = page.render(renderContext)

    render.promise.then(function() {
      if(afterRendered)
      {
        afterRendered(p);
      }
    })
  })
  .catch(function (reason) {
    console.error('Page could not be rendered: ' + reason);
  });
}

function canvasLeft(rect)
{
  // console.log('rect: ' + rect);
  var s = $("#viz-svg");

  var cleft =   (s.offset().left + (s.outerWidth(true) - s.width()) / 2
    + parseInt(rect.attr('x'))) + "px";
  // console.log("left: " + cleft);
  return cleft;
}

function canvasTop(rect)
{
  var s = $("#viz-svg");

  var ctop = (s.offset().top + (s.outerHeight(true) - s.height()) / 2
    + parseInt(rect.attr('y'))) + "px";
  return ctop;
}

function setNpages(n)
{
  // Depending on new value of npages, push/pop new pages to end
  if(n > npages)
  {
    for(var i = 0; i < (n-npages); i++)
    {
      pages.push({
        index: i,
        thumb: null,
        img: null
      });
    }
  }
  else if(n < npages)
  {
    for(var i = 0; i < (npages-n); i++)
    {
      pages.pop();
    }
  }
  // $('#npages-slider').slider( "option", "value", n);
  // $('#currpage-handle').slider( "option", "max", n);
  npages = n;

  // Initalize current page slider
  $(function() {
    var handle = $("#currpage-handle");
    $("#currpage-slider").slider({
      min: 1,
      max: n,
      create: function() {
        handle.text($(this).slider("value"));
        currPage = $(this).slider("value")-1;
        update();
      },
      slide: function(event, ui) {
        handle.text(ui.value);
        currPage = ui.value-1;
        update();
      }
    });
  });
}

// Get position and dimensions of pages.
// depends on which page is currently open
function getPageX(d,i)
{
  x = parseInt(i / PAGES_PER_COL) * PAGE_SHIFT_X;
  if(i < currPage)
    return x;
  else if (i == currPage)
    return x + 2 * PAGE_SHIFT_X;
  else
    return x + 3 * PAGE_SHIFT_X + FULL_PAGE_WIDTH;
}

function getPageY(d,i)
{
  if(i == currPage)
    return 0;
  else
    return parseInt(i % PAGES_PER_COL) * PAGE_SHIFT_Y;
}

function getPageW(d,i)
{
  if(i == currPage)
    return FULL_PAGE_WIDTH;
  else
    return PAGE_WIDTH;
}

function getPageH(d,i)
{
  if(i == currPage)
    return FULL_PAGE_HEIGHT;
  else
    return PAGE_HEIGHT;
}

function update() {

  var selection = svg.selectAll('rect')
    .data(pages);

  selection.enter()
    .append('rect')
    .style('fill', '#e2e3e3')
    .on('mouseover', function(d, i) {
      d3.select(this)
        .style('fill', '#008ae6');
      pages[i].thumb
        .style('visibility', 'hidden');
      svg.append('text')
        .attr('id', 'hover-num')
        .attr('x', getPageX(d,i) + getPageW(d,i) / 2)
        .attr('y', getPageY(d,i) + getPageH(d,i) / 2)
        .style('font-size', 12)
        .style('cursor', 'default')
        .attr('text-anchor', 'middle')
        .style('fill', '#e2e3e3')
        .style('pointer-events', 'none')
        .text(i+1);
      currRect.style('fill', '#008ae6')
      previewPage = i;
      update();
    })
    .on('mouseout', function(d, i) {
      d3.select(this)
        .style('fill', '#e2e3e3');
      pages[i].thumb
        .style('visibility', 'visible');
      svg.select('#hover-num').remove();
      currRect.style('fill', '#e2e3e3')
      previewPage = null;
      update();
    })
    .on('click', function(d,i) {
      currPage = i;
      scrollY = 0;
      update();
    });

  selection
    .attr('x', getPageX)
    .attr('y', getPageY)
    .attr('width', getPageW)
    .attr('height', getPageH)
    .attr('rx', 1)
    .attr('ry', 1)
    .style('stroke', '#000')
    .style('stroke-width', 0);

  selection.exit().remove();

  // Update PDF canvas with new page
  if(pdf)
  {
    d3.select('#pdf-canvas')
      .datum(currPage)
      .each(function(d) {
        var p = parseInt(d);
        console.log("Rendering page: " + p);
        // Fetch and render currPage
        var canvas = document.getElementById('pdf-canvas');

        // If preview page exists, render that instead
        if(previewPage)
        {
          renderPage(previewPage, canvas,
            {width: FULL_PAGE_WIDTH, height: FULL_PAGE_HEIGHT, scrollY:0});
        }
        else
        {
          renderPage(p, canvas, {width: FULL_PAGE_WIDTH, 
                                 height: FULL_PAGE_HEIGHT, 
                                 scrollY: scrollY});
        }
      });

    // Reposition main pdf canvas
    currRect = d3.selectAll('rect').filter(function(d,i) {return i == currPage;});

    console.log("rect pre: " + currRect);
    d3.select('#pdf-container')
      .style('left', canvasLeft(currRect))
      .style('top', canvasTop(currRect));

    // Reposition all thumbnails
    d3.selectAll('rect')
      .each(function (d,i){
        p = d3.select(this);
        d.thumb.style('left', canvasLeft(p))
        d.thumb.style('top', canvasTop(p));
      });

  }

}