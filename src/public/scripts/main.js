'use strict';

const COLORPICKER_LENGTH = 200;
const COLORPICKER_CONTAINER_HEIGHT = 290;
const PEN_WIDTH = 7;
const ERASER_WIDTH = 14;

const TOOLITEM_PEN = 'pen';
const TOOLITEM_ERASER = 'eraser';

$(document).ready(function() {
  let socket = io('/command');
  let canvas = document.getElementById('whiteboard');
  let context = canvas.getContext('2d');
  let control = $('#control');
  let colorPickerContainer = $('#colorPickerContainer');

  let selectedColor = '#356eae';
  let selectedTool = TOOLITEM_PEN;
  let selectedPenWidth = PEN_WIDTH;
  let drawing = false;
  let saved = {};

  // Load initial image
  let image = new Image();
  image.onload = function() {
    context.drawImage(image, 0, 0);
  }; 
  image.src = '/canvas';

  // Load author information
  $.ajax('/author').done(function(data) {
    // Set user name
    $('#authorUserName').find(".value").text(data.userName);
    // Set GitHub ID
    let authorGitHubId = $('#authorGitHubId');
    let gitHubIdValue = authorGitHubId.find(".value");
    gitHubIdValue.text(data.gitHubId);
    authorGitHubId.on("click", function() {
      window.open('https://github.com/' + gitHubIdValue.text());
    });
    // Set twitter ID (optional)
    if (data.twitterId !== undefined && data.twitterId !== "") {
      let authorTwitterId = $('#authorTwitterId'); 
      let twitterIdValue = authorTwitterId.find(".value");
      twitterIdValue.text(data.twitterId);
      authorTwitterId.on("click", function() {
        window.open('https://twitter.com/' + twitterIdValue.text());
      });
      $('#authorTwitterId').show();
    } else {
      $('#authorTwitterId').hide();
    }
    // Set comment
    $('#authorComment').find(".value").text(data.comment);
  });

  // Setup tools
  let toolItemPen = $('#toolItemPen');
  toolItemPen.on('click', function() {
    selectPenTool();
  });
  let toolItemEraser = $('#toolItemEraser');
  toolItemEraser.on('click', function() {
    selectEraserTool();
  });
  
  // Setup color picker
  let iroPicker = new window.iro.ColorPicker("#colorPicker", {
    width: COLORPICKER_LENGTH,
    height: COLORPICKER_LENGTH,
    color: selectedColor,
    markerRadius: 3
  });
  iroPicker.on('color:change', function(color, changes) {
    selectedColor = color.hexString;
    selectPenTool();
  });
  iroPicker.on('mount', onResize());

  // socket.io drawing event handler
  socket.on('drawing', onDrawingEvent);

  // Start listening mouse events
  canvas.addEventListener('mousedown', onMouseDown, false);
  canvas.addEventListener('mousemove', throttle(onMouseMove, 10), false);
  canvas.addEventListener('mouseup', onMouseUp, false);
  canvas.addEventListener('mouseout', onMouseUp, false);

  // Start listening touch events
  canvas.addEventListener("touchstart", onTouchStart, false);
  canvas.addEventListener("touchmove", throttle(onTouchMove, 10), false);
  canvas.addEventListener("touchend", onTouchEnd, false);
  canvas.addEventListener("touchcancel", onTouchEnd, false);

  // resize event handler
  window.addEventListener('resize', onResize, false);
  window.addEventListener('scroll', onResize, false);

  function selectPenTool() {
    selectedTool = TOOLITEM_PEN;
  }

  function selectEraserTool() {
    selectedTool = TOOLITEM_ERASER;
  }

  function drawLine(data, emit) {
    draw.line(context, data.x0, data.y0, data.x1, data.y1, data.color, data.width);
    if (!emit) { return; }
    // Notify the server of drawing
    socket.emit('drawing', data);
  }

  function getCanvasPoint(e) {
    let rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  function drawLineToCursor(current) {
    let data = {
      x0: saved.x,
      y0: saved.y,
      x1: current.x,
      y1: current.y,
      color: selectedColor,
      width: selectedPenWidth
    }
    if (selectedTool == TOOLITEM_PEN) {
      data.color = selectedColor;
      data.width = selectedPenWidth;
    } else {
      data.color = 'white';
      data.width = ERASER_WIDTH;
    }
    drawLine(data, true);    
  }

  // Mouse event handlers
  function onMouseDown(e) {
    drawing = true;
    saved = getCanvasPoint(e);
  }

  function onMouseMove(e) {
    if (!drawing) { return; }
    let current = getCanvasPoint(e);
    drawLineToCursor(current);
    saved = current;
  }

  function onMouseUp(e) {
    if (!drawing) { return; }
    drawing = false;
    let current = getCanvasPoint(e);
    drawLineToCursor(current);
  }

  // Touch event handlers
  function onTouchStart(e) {
    if (1 < e.touches.length) {
      drawing = false;
      return;
    }
    drawing = true;
    saved = getCanvasPoint(e.touches[0]);
  }

  function onTouchMove(e) {
    if (!drawing) { return; }
    e.preventDefault();
    let current = getCanvasPoint(e.touches[0]);
    drawLineToCursor(current);
    saved = current;
  }

  function onTouchEnd(e) {
    if (!drawing) { return; }
    drawing = false;
    let current = getCanvasPoint(e.touches[0]);
    drawLineToCursor(current);
  }

  // limit the number of events per second
  function throttle(callback, delay) {
    let previousCall = new Date().getTime();
    return function() {
      let time = new Date().getTime();

      if ((time - previousCall) >= delay) {
        previousCall = time;
        callback.apply(null, arguments);
      }
    };
  }

  // Replicate remote drawing to this canvas
  function onDrawingEvent(data) {
    drawLine(data);
  }

  // make the canvas fill its parent
  function onResize() {
    let wb = $(window).scrollTop() + $(window).height();
    let top = control.height() <= wb ?
      control.height() - COLORPICKER_CONTAINER_HEIGHT :
      wb - COLORPICKER_CONTAINER_HEIGHT;
    colorPickerContainer.css({ top: top });
  }

});
