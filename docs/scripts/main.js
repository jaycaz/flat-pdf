  var pdf;

var drop = d3.select('#pdf-dropzone');
drop.style('height', '100%');

Dropzone.options.pdfDropzone = {
  paramName: "file", // The name that will be used to transfer the file
  clickable: false,
  maxFilesize: 100, // MB
  dictDefaultMessage: "Upload any PDF to flatten it",
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
      drop.remove();

      // Add instructional text for searching
      d3.select('body')
        .insert('p', ':first-child')
        .attr('id', 'extracting')
        .style('height', '20px')
        .text('Extracting text, one moment...');
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
// var previewPage = null;
var scrollY = 0;
var words = {};
var queries = [''];
var visitedPages = [currPage];
var visitedPtr = 0;

// Cached values for convenience
var currRect;

// Global variables for page dimensions
// I know this is probably not the JS way to do it, sue me
var PAGE_WIDTH = 40;
var PAGE_WIDTH_PADDING = 5;
var PAGE_HEIGHT_PADDING = 2;
var PAGE_HEIGHT = 37;
var PAGE_SHIFT_X = 40;
var PAGE_SHIFT_Y = 35;
var PAGES_PER_COL = 20;
var FULL_PAGE_WIDTH = 820;
var FULL_PAGE_HEIGHT = 1060;

// How many "regions" page should be broken into when drawing search lines
var QUERY_REGIONS_PER_PAGE = 8;

var SCROLL_SENSITIVITY = 2.0;

// Create PDF canvas for placement
var pdfContainer = d3.select("#viz")
  .append('div')
  .attr("id", "pdf-container")
  .style("position", "absolute")
  .style("left", "0")
  .style("top", "0")
  .style("display", "inline-block")
  .style("z-index", "1");

// Canvas for rendering page img
var canvas = pdfContainer.append("canvas")
  .attr("id", "pdf-canvas")
  .style('padding-left', PAGE_WIDTH_PADDING + "px")
  .style('padding-right', PAGE_WIDTH_PADDING + "px")
  .style('padding-top', PAGE_HEIGHT_PADDING + "px")
  .style('padding-bottom', PAGE_HEIGHT_PADDING + "px");

// Element to store rendered text
var pdfText = pdfContainer.append("div")
  .attr("id", "pdf-text")
  .attr("class", "textLayer");

var svg = d3.select("#viz")
  .append("svg")
  .attr("id", "viz-svg")
  .attr("width", "200%")
  .attr("height", FULL_PAGE_HEIGHT)
  .style("padding", "10px")

var thumbnails = d3.select("#viz")
  .append("div")
  .attr("id", "thumbnails");

// Mouse wheel will scroll current page, and eventually trigger a new page
d3.select('body')
  .on("wheel.zoom", function() {
    // Mouse wheel scrolls a page
    if(!pdf)
    {
      return;
    }
    dy = d3.event.wheelDeltaY * SCROLL_SENSITIVITY;
    scrollY += dy;

    // Scrolling out of bounds triggers the next/prev page, if any
    if(scrollY < -FULL_PAGE_HEIGHT)
    {
      scrollY = 0;
      if(currPage < npages-1)
      {
        currPage++;
        visitedPages[visitedPtr]++;
        update();
      }
    }
    if(scrollY > FULL_PAGE_HEIGHT)
    {
      scrollY = 0;
      if(currPage > 0)
      {
        currPage--;
        visitedPages[visitedPtr]--;
        update();
      }
    }

    var vizTop = $('#viz').offset().top;
    var c = d3.select('#pdf-container')

    console.log('top: ' + (vizTop + scrollY) + 'px');

    c.style('top', (vizTop + scrollY) + 'px');
    // update();
  })
  .on("keydown", function() {
    // Keypress will add on to the last query word
    d3.event.stopPropagation();
    var c = String.fromCharCode(d3.event.keyCode).toLowerCase();
    if((c >= '0' && c <= '9') || (c >= 'a' && c <= 'z'))
    {
      queries[queries.length-1] += c;
    }

    // Backspace will delete characters from the last entry, and subsequent
    // entries if user keeps pressing it
    if(d3.event.keyCode === 8 || d3.event.keyCode === 46)
    {
      if(queries[queries.length-1] !== '')
      {
        queries[queries.length-1] = queries[queries.length-1].slice(0,-1);
      }
      else if(queries.length > 1)
      {
        queries = queries.slice(0,-1);
      }
    }

    // Escape will clear the selection
    if(d3.event.keyCode === 27)
    {
      queries = [''];
    }

    // Arrow keys go back and forth in the visited pages stack
    if(d3.event.keyCode === 37 && visitedPtr > 0)
    {
      visitedPtr--;
      currPage = visitedPages[visitedPtr];
      updatePages();
    }
    if(d3.event.keyCode === 39 && visitedPtr < visitedPages.length-1)
    {
      visitedPtr++;
      currPage = visitedPages[visitedPtr];
      updatePages();
    }

    // Spacebar will finish current query word and break off to a new one
    if(d3.event.keyCode === ' '.charCodeAt(0))
    {
      queries.push('');
    }
    console.log(queries);
    updateMarks();
  });

// Handle reading in dropped PDF
function readPDF(data) {
  PDFJS.getDocument(data).then( function (doc) {
    console.log('Loaded pdf, number of pages: ' + doc.numPages);
    setNpages(doc.numPages);
    pdf = doc;
    generateThumbnails();
    extractText();
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
    var thumbCanvas = thumbnails
      .append('canvas')
      .attr('id', 'thumbnail-canvas-' + i)
      .style('position', 'absolute')
      .style('padding-left', PAGE_WIDTH_PADDING + "px")
      .style('padding-right', PAGE_WIDTH_PADDING + "px")
      .style('padding-top', PAGE_HEIGHT_PADDING + "px")
      .style('padding-bottom', PAGE_HEIGHT_PADDING + "px")
      .style('pointer-events', 'none');

    var c = document.getElementById('thumbnail-canvas-' + i);
    // console.log('canvas: ' + c);
    pages[i].thumb = thumbCanvas;

    renderPage(i, c, {width: PAGE_WIDTH, height: PAGE_HEIGHT, scrollY:0}, function(p) {
        // console.dir(p);
        pages[p.index].img = c.toDataURL();
        // console.log("Img[" + i + "]: " + pages[i].img);

        // Adjust image for better clarity at small scales
        Caman('#thumbnail-canvas-'+p.index, function() {
          this.exposure(50);
          this.saturation(-50);
          this.render();
        });
      });
  }
}

function cleanWord(w)
{
  if (!w)
  {
    return null;
  }

  cw = w.toLowerCase();
  cw = cw.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
  // cw = cw.replace(/\s{2,}/g," ");

  return cw;
}

function extractText()
{
  console.log("Extracting text...");
  var completedPages = 0;
  for(var i = 0; i < npages; i++)
  {
    pdf.getPage(i+1).then(function(page) {
      page.getTextContent().then(function(textContent) {
        // console.log(page.pageIndex + ": " + pages);
        pages[page.pageIndex].text = textContent;

        // Extract raw text from all of the objects so it's easier to work with
        var lines = []
        var currLine = "";
        for(var j = 0; j < textContent.items.length; j++)
        {
          item = textContent.items[j];
          // Join 'lines' that are on the same y, they're supposed to be together
          if(j > 0 && textContent.items[j-1].transform[5] === item.transform[5])
          {
            currLine += item.str;
          }
          else
          {
            lines.push(currLine);
            currLine = item.str;
          }

          if(j == textContent.items.length - 1)
          {
            lines.push(currLine);
          }
        }

        var rawText = lines.join("\n");
        // console.log(page.pageIndex + ": " + rawText);

        // For each word, document which pages it appears in and where on the page
        for(var j = 0; j < lines.length; j++)
        {
          lines[j].split(/\s+/).forEach(function(raw_word) {
            // if(!raw_word) return;
            w = cleanWord(raw_word);
            if(w === "") return;
            // console.log(w);

            if(!words[w]) {
              words[w] = []
            }

            pageHeight = page.view[3];

            appearance = {
              page: page.pageIndex,
              // normalized y coord
              y: textContent.items[j].transform[5] / pageHeight
            }

            words[w].push(appearance);

          })

          // Update text on progress
          completedPages++;
          d3.select('#extracting')
            .text('Extracting: ' + completedPages + ' of ' + npages);

          // Only show prompt to search once all pages are done
          if(completedPages == npages)
          {
            d3.select('#extracting').remove();

            d3.select('body')
              .insert('p', ':first-child')
              .attr('id', 'visited-pages')
              .style('height', '20px')
              .text(' ');
            d3.select('body')
              .insert('p', ':first-child')
              .attr('id', 'queries')
              .style('height', '20px')
              .text(' ');
            d3.select('body')
              .insert('p', ':first-child')
              .html("Start typing to search for text. ESC to clear.</br> \
               Use the L/R arrow keys to go back to previously visited pages.")

            update();
          }
        }

        pages[page.pageIndex].rawText = rawText;
      })
    })
  }
}

// Perform a query on the doc using the given words
// Add a copy of the word's index for each occurrence
function queryWords(queries) {

  matches = [];
  for(var i = 0; i < queries.length; i++)
  {
    w = queries[i]
    if(!words[w])
    {
      continue;
    }

    words[w].forEach(function(appearance) {
      var region = parseInt(appearance.y * QUERY_REGIONS_PER_PAGE);

      matches.push({
        page: appearance.page,
        region: region,
        word: i
      });
    });
  }

  return matches;
}

// Perform a query on the doc using the given words
// Return a score for unique words matching on a page
function scorePages(queries) {

  scores = [];
  for(var i = 0; i < npages; i++)
  {
    scores.push({
      page: i,
      score: 0
    })
  }

  for(var i = 0; i < queries.length; i++)
  {
    score_i = new Array(npages);
    for(var j = 0; j < npages; j++)
    {
      score_i[j] = 0;
    }
    // score_i.fill(0);

    w = queries[i]
    if(!words[w])
    {
      continue;
    }

    words[w].forEach(function(appearance) {
      score_i[appearance.page] = 1;
    });

    for(var j = 0; j < scores.length; j++)
    {
      scores[j].score += score_i[j];
    }
  }

  return scores;
}

function getPDFViewport(page, dims)
{
  //Resize PDF viewport to fit canvas
  //TODO: Make the border not a magic number
  var viewport = page.getViewport(1);
  sw = (dims.width - 2*PAGE_WIDTH_PADDING) / viewport.width;
  sh = (dims.height - 2*PAGE_HEIGHT_PADDING) / viewport.height;
  viewport = page.getViewport(Math.min(sw,sh));

  return viewport;
}

// Render page number p on a particular canvas with particular dimensions {width, height}
function renderPage(p, canvas, dims, afterRendered)
{
  pdf.getPage(p+1) // Pages are one-indexed in PDFJS
  .then(function (page) {

    viewport = getPDFViewport(page, dims);

    // TODO: Work with d3 selections instead of jquery, i.e. canvas.attr?
    canvas.height = viewport.height
    canvas.width = viewport.width;
    var context = canvas.getContext('2d');
    // context.clearRect(0, 0, canvas.width, canvas.height);
    context. setTransform(1, 0, 0, 1, 0, 0);
    context.translate(0, scrollY);
    // var pageTimestamp = new Date().getTime();
    // var timestamp = pageTimestamp;
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
        afterRendered({index: p, page: page});
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
        img: null,
        text: null,
        rawText: null
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

  // // Initalize current page slider
  // $(function() {
  //   var handle = $("#currpage-handle");
  //   $("#currpage-slider").slider({
  //     min: 1,
  //     max: n,
  //     create: function() {
  //       handle.text($(this).slider("value"));
  //       currPage = $(this).slider("value")-1;
  //       update();
  //     },
  //     slide: function(event, ui) {
  //       handle.text(ui.value);
  //       currPage = ui.value-1;
  //       update();
  //     }
  //   });
  // });
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

function updatePages() {

  var selection = svg.selectAll('rect')
    .data(pages);

  selection.enter()
    .append('rect')
    .style('fill', '#e2e3e3')
    .on('mouseover', function(d, i) {
      d3.select(this)
        .style('fill', '#008ae6')
        .classed('mouse', true);
      pages[i].thumb
        .style('visibility', 'hidden');
      svg.selectAll('highlight')
        .filter('.page-' + i)
        .style('visibility', 'hidden');
      svg.append('text')
        .attr('id', 'hover-num')
        .attr('x', getPageX(d,i) + getPageW(d,i) / 2)
        .attr('y', getPageY(d,i) + getPageH(d,i) / 2)
        .style('font-size', 16)
        .style('cursor', 'default')
        .attr('text-anchor', 'middle')
        .style('fill', '#e2e3e3')
        .style('pointer-events', 'none')
        .text(i+1);
      currRect.style('fill', '#008ae6');
      // previewPage = i;
      // update();
    })
    .on('mouseout', function(d, i) {
      d3.select('.mouse')
        .style('fill', '#e2e3e3')
        .classed('mouse', false);
      pages[i].thumb
        .style('visibility', 'visible');
      svg.selectAll('highlight')
        .filter('.page-' + i)
        .style('visibility', 'visible');
      svg.select('#hover-num').remove();
      currRect.style('fill', '#e2e3e3');
      // previewPage = null;
      // update();
    })
    .on('click', function(d,i) {

      if(visitedPtr)
      {
        visitedPages = visitedPages.slice(0,visitedPtr+1);
      }
      visitedPages.push(i);
      visitedPtr = visitedPages.length-1;
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
        // console.log("Rendering page: " + p);
        // Fetch and render currPage
        var canvas = document.getElementById('pdf-canvas');

        // // If preview page exists, render that instead
        // if(previewPage)
        // {
        //   renderPage(previewPage, canvas,
        //     {width: FULL_PAGE_WIDTH, height: FULL_PAGE_HEIGHT, scrollY:0});
        // }
        // else
        // {
          var dims = {width: FULL_PAGE_WIDTH, height: FULL_PAGE_HEIGHT, scrollY: scrollY}
          renderPage(p, canvas, dims, function(p) {

            // After rendering page, render text layer on top
            p.page.getTextContent().then(function(textContent) {
              console.log("page " + p.index + " text: " + textContent);
              var textLayer = new TextLayerBuilder({
                textLayerDiv: document.getElementById("pdf-text"),
                pageIndex: p.index,
                viewport: getPDFViewport(p.page, dims)
              });
              textLayer.setTextContent(textContent);
              textLayer.render();
                // .then(function() {console.log("text rendered!")})
                // .catch(function() {console.error("text could not be rendered")});
              });
           });
        // }
      });

    // Reposition main pdf canvas
    currRect = d3.selectAll('rect').filter(function(d,i) {return i == currPage;});

    // console.log("rect pre: " + currRect);
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

function updateMarks() {

  if(pdf) {
    // Add query highlights for each thumbnail
    // matches = queryWords(queries);
    scores = scorePages(queries);
    console.dir(scores);

    // console.dir(matches);
    svg.selectAll('.highlight').remove();
    svg.selectAll('.highlight')
      // .data(matches)
      .data(scores)
      .enter()
      .append('rect')
      .attr('id', function(d,i) { return 'match-' + i;})
      .attr("class", function(d,i) { return "highlight page-" + d.page;})
      .attr('x', function(d) { return getPageX(d,d.page);})
      // .attr('y', function(d) { return getPageY(d,d.page) + (d.region / QUERY_REGIONS_PER_PAGE) * getPageH(d,d.page))
      .attr('y', function(d) { return getPageY(d,d.page);})
      .attr('width', function(d) { return getPageW(d,d.page) - PAGE_WIDTH_PADDING;})
      // .attr('height', function(d) { return 5)
      .attr('height', function(d) { return getPageH(d,d.page);})
      .style('z-index', 2)
      // .style('fill', function(d,i) { return colors[d.word % colors.length];})
      .style('fill', function(d,i) { return colors[Math.min(d.score, queries.length)];})
      .style('opacity', function(d,i) { return d.score == 0 ? 0.0 : 1.0;})
      .style('pointer-events', 'none');

    d3.select('#queries')
      .datum(queries)
      .text(function(d) { return " " + d.join(" ");});
    }

    d3.select('#visited-pages')
      .datum(visitedPages)
      .text(function(d) {
        str = "";
        for(var i = 0; i < d.length; i++)
        {
          if(i == visitedPtr)
          {
            str += "(" + (parseInt(visitedPages[i])+1) + ") ";
          }
          else
          {
            str += (parseInt(visitedPages[i])+1) + " ";
          }
        }
        return str;
      })
}

function update() {
  updatePages();
  updateMarks();
}

var colors = ["#ffffcc","#fed976","#feb24c","#fd8d3c","#fc4e2a","#e31a1c","#bd0026","#800026"]