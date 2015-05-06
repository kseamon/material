/**
 * @ngdoc module
 * @name material.components.virtualRepeat
 */
angular.module('material.components.virtualRepeat', [
  'material.core',
  'material.core.gestures'
])
.directive('mdVirtualRepeatContainer', VirtualRepeatContainerDirective)
.directive('mdVirtualRepeat', VirtualRepeatDirective);


/**
 * @ngdoc directive
 * @name mdVirtualRepeatContainer
 * @module material.components.virtualRepeat
 * @restrict E
 * @description
 * `md-virtual-repeat-container` provides the scroll container for md-virtual-repeat.
 *
 * Virtual repeat is a limited substitute for ng-repeat that allows renders only
 * enough dom nodes to fill the container and recycling them as the user scrolls.
 *
 * @usage
 * <hljs lang="html">
 * <md-virtual-repeat-container md-horizonal>
 *   <div md-virtual-repeat="i in items">Hello {{i}}!</div>
 * </md-virtual-repeat-containr>
 *
 * <md-virtual-repeat-container md-horizonal>
 *   <div md-virtual-repeat="i in items">Hello {{i}}!</div>
 * </md-virtual-repeat-containr>
 * </hljs>
 *
 * @param {boolean=} md-horizontal Whether the container should scroll horizontally
 *     (defaults to scrolling vertically).
 */
function VirtualRepeatContainerDirective() {
  return {
    controller: VirtualRepeatContainerController,
    replace: true,
    require: 'virtualRepeatContainer',
    restrict: 'E',
    template: VirtualRepeatContainerTemplate
  };
}


function VirtualRepeatContainerTemplate($element, $attrs) {
  var innerHtml = $element[0].innerHTML;
  $element[0].innerHTML = '';
  // TODO: we probably don't need the container anymore.
  return '<div class="md-virtual-repeat-container ' +
      ($attrs.mdHorizontal ? 'md-horizontal' : 'md-vertical') + '">' +
    '<div class="md-virtual-repeat-scroller">' +
      '<div class="md-virtual-repeat-sizer"></div>' +
      '<div class="md-virtual-repeat-offsetter">' +
        innerHtml +
      '</div>' +
    '</div>' +
  '</div>';
}


function VirtualRepeatContainerController($scope, $element, $attrs, $timeout, $window) {
  this.$scope = $scope;
  this.$element = $element;
  this.$attrs = $attrs;
  this.$timeout = $timeout;
  this.$window = $window;

  this.size = 0;
  this.scrollSize = 0;
  this.scrollOffset = 0;
  this.repeater = null;

  this.scroller = $element[0].getElementsByClassName('md-virtual-repeat-scroller')[0];
  this.sizer = this.scroller.getElementsByClassName('md-virtual-repeat-sizer')[0];
  this.offsetter = this.scroller.getElementsByClassName('md-virtual-repeat-offsetter')[0];

  this.handleScroll_ = this.handleScroll_.bind(this, !!$attrs.mdHorizontal);

  $window.requestAnimationFrame(this.updateSize.bind(this));
}


/** Called by the md-virtual-repeat inside of the container at startup. */
VirtualRepeatContainerController.prototype.register = function(repeaterCtrl) {
  this.repeater = repeaterCtrl;
  
  angular.element(this.scroller)
      .on('scroll wheel touchmove touchend', this.handleScroll_);
};


/** @return {boolean} Whether the container is configured for horizontal scrolling. */
VirtualRepeatContainerController.prototype.isHorizontal = function() {
  return !!this.$attrs.mdHorizontal;
};


/** @return {number} The size (width or height) of the container. */
VirtualRepeatContainerController.prototype.getSize = function() {
  return this.size;
};


/** Instructs the container to re-measure its size. */
VirtualRepeatContainerController.prototype.updateSize = function() {
  this.size = this.$attrs.mdHorizontal
      ? this.$element[0].clientWidth
      : this.$element[0].clientHeight;
  this.repeater && this.repeater.containerUpdated();
};


/** @return {number} The container's scrollHeight or scrollWidth. */
VirtualRepeatContainerController.prototype.getScrollSize = function() {
  return this.scrollSize;
};


/**
 * Sets the scrollHeight or scrollWidth. Called by the repeater based on
 * its item count and item size.
 * @param {number} The new size.
 */
VirtualRepeatContainerController.prototype.setScrollSize = function(size) {
  if (this.scrollSize !== size) {
    this.sizer.style[this.$attrs.mdHorizontal ? 'width' : 'height'] = size + 'px';
  }

  this.scrollSize = size;
};


/** @return {number} The container's current scroll offset. */
VirtualRepeatContainerController.prototype.getScrollOffset = function() {
  return this.scrollOffset;
};


VirtualRepeatContainerController.prototype.handleScroll_ = function(horizontal, evt) {
  var oldOffset = this.scrollOffset;

  this.scrollOffset = Math.min(this.scrollSize - this.size,
      Math.max(0, horizontal ? this.scroller.scrollLeft : this.scroller.scrollTop));

  if (oldOffset !== this.scrollOffset) this.repeater.containerUpdated();
};


/**
 * @ngdoc directive
 * @name mdVirtualRepeat
 * @module material.components.virtualRepeat
 * @restrict A
 * @description
 * `md-virtual-repeat` specifies an element to repeat using virtual scrolling.
 *
 * Virtual repeat is a limited substitute for ng-repeat that allows renders only
 * enough dom nodes to fill the container and recycling them as the user scrolls.
 *
 * @usage
 * <hljs lang="html">
 * <md-virtual-repeat-container md-horizonal>
 *   <div md-virtual-repeat="i in items">Hello {{i}}!</div>
 * </md-virtual-repeat-containr>
 *
 * <md-virtual-repeat-container md-horizonal>
 *   <div md-virtual-repeat="i in items">Hello {{i}}!</div>
 * </md-virtual-repeat-containr>
 * </hljs>
 *
 * @param {number=} md-size The height or width of the repeated elements (which
 *     must be identical for each element). TODO: If absent, the directive will attempt to
 *     measure the computed style of the element at startup.
 */
function VirtualRepeatDirective($parse) {
  return {
    controller: VirtualRepeatController,
    priority: 1000,
    require: ['mdVirtualRepeat', '^mdVirtualRepeatContainer'],
    restrict: 'A',
    terminal: true,
    transclude: 'element',
    compile: function VirtualRepeatCompile($element, $attrs) {
      var expression = $attrs.mdVirtualRepeat;
      var match = expression.match(/^\s*([\s\S]+?)\s+in\s+([\s\S]+?)\s*$/);
      var lhs = match[1];
      var rhs = $parse(match[2]);

      return function VirtualRepeatLink($scope, $element, $attrs, ctrl, $transclude) {
        ctrl[0].link_(ctrl[1], $transclude, lhs, rhs);
      };
    }
  };
}


function VirtualRepeatController($scope, $element, $attrs, $browser, $document) {
  this.$scope = $scope;
  this.$element = $element;
  this.$attrs = $attrs;
  this.$browser = $browser;
  this.$document = $document;

  this.browserCheckUrlChange = $browser.$$checkUrlChange;
  this.newStartIndex = 0;
  this.newEndIndex = 0;
  this.startIndex = 0;
  this.endIndex = 0;
  // TODO: measure width/height of first element from dom if not provided.
  // getComputedStyle?
  this.itemSize = $scope.$eval($attrs.mdSize);
  this.blocks = {};
  this.pooledBlocks = [];
  this.numBlocks = 0;
}


/**
 * Called at startup by the md-virtual-repeat postLink function.
 * @param {!VirtualRepeatContainerController} The container's controller.
 * @param {!Function} The repeated element's bound transclude function.
 * @param {string} lhs The left hand side of the repeat expression, indicating
 *     the name for each item in the array.
 * @param {!Function} rhs A compiled expression based on the right hand side
 *     of the repeat expression. Points to the array to repeat over.
 */
VirtualRepeatController.prototype.link_ = function(container, transclude, lhs, rhs) {
  this.container = container;
  this.transclude = transclude;
  this.lhs = lhs;
  this.rhs = rhs;
  this.sized = false;

  this.container.register(this);
};


/**
 * Called by the container. Informs us that the containers scroll or size has
 * changed.
 */
VirtualRepeatController.prototype.containerUpdated = function() {
  var NUM_EXTRA = 3;

  if (!this.sized) {
    this.sized = true;
    this.$scope.$watchCollection(this.rhs, this.virtualRepeatUpdate_.bind(this));
    this.items = this.rhs(this.$scope);
  }

  var itemsLength = this.items ? this.items.length : 0;
  var containerLength = Math.ceil(this.container.getSize() / this.itemSize);
  this.newStartIndex = Math.max(0, Math.min(
          itemsLength - containerLength,
          Math.floor(this.container.getScrollOffset() / this.itemSize)));
  this.newEndIndex = Math.min(itemsLength, this.newStartIndex + containerLength + NUM_EXTRA);
  this.newStartIndex = Math.max(0, this.newStartIndex - NUM_EXTRA);

  if (this.newStartIndex !== this.startIndex ||
      this.newEndIndex !== this.endIndex ||
      this.container.getScrollOffset() > this.container.getScrollSize()) {
    this.virtualRepeatUpdate_(this.items, this.items);
  }
};


VirtualRepeatController.prototype.virtualRepeatUpdate_ = function(items, oldItems) {
  this.items = items;
  this.parentNode = null;

  this.container.setScrollSize((this.items ? this.items.length : 0) * this.itemSize);
  
  // Detach and pool any blocks that are no longer in the viewport.
  Object.keys(this.blocks).forEach(function(blockIndex) {
    var index = parseInt(blockIndex);
    if (index < this.newStartIndex || index > this.newEndIndex) {
      this.poolBlock_(index);
    }
  }, this);

  // Add needed blocks.
  var newStartBlocks = [];
  var block;
  // For performance reasons, temporarily block browser url checks as we digest
  // the restored block scopes.
  this.$browser.$$checkUrlChange = angular.noop;

  for (var i = this.newStartIndex; i < this.newEndIndex; i++) {
    if (this.blocks[i]) continue;

    block = this.getBlock_();
    this.updateBlock_(block, i);
    newStartBlocks.push(block);
  }

  // Restore $$checkUrlChange.
  this.$browser.$$checkUrlChange = this.browserCheckUrlChange;

  this.pooledBlocks.forEach(function(block) {
    // TODO: translateX when horizontal.
    block.element[0].style.webkitTransform = 'translateY(-1000px)';
    block.element[0].style.transform = 'translateY(-1000px)';
  });

  this.startIndex = this.newStartIndex;
  this.endIndex = this.newEndIndex;
};


VirtualRepeatController.prototype.getBlock_ = function() {
  if (this.pooledBlocks.length) {
    return this.pooledBlocks.pop();
  }

  var block;
  this.transclude(function(clone, scope) {
    block = {
      element: clone,
      scope: scope,
      index: this.numBlocks++
    };
    this.parentNode = this.parentNode || this.$element[0].parentNode;
    this.parentNode.appendChild(clone[0]);
  }.bind(this));

  return block;
};


VirtualRepeatController.prototype.updateBlock_ = function(block, index) {
  // Update and digest the block's scope.
  block.scope.$index = index;
  block.scope[this.lhs] = this.items[index];
  this.blocks[index] = block;
  block.scope.$digest();

  // Position the element based on its new $index.
  var transform = (this.container.isHorizontal() ? 'translateX(' : 'translateY(')
      + ((index - block.index) * this.itemSize) + 'px)';
  block.element[0].style.webkitTransform = transform;
  block.element[0].style.transform = transform;
};


VirtualRepeatController.prototype.poolBlock_ = function(index) {
  this.pooledBlocks.push(this.blocks[index]);
  delete this.blocks[index];
};
