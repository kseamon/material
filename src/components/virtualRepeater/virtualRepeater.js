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


// md-horizontal (defaults to vertical)
function VirtualRepeatContainerDirective() {
  return {
    controller: VirtualRepeatContainerController,
    replace: true,
    require: 'virtualRepeatContainer',
    template: VirtualRepeatContainerTemplate
  };
}

function VirtualRepeatContainerTemplate($element, $attrs) {
  var innerHtml = $element[0].innerHTML;
  $element[0].innerHTML = '';

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
  this.offsetterWillChange = false;
  this.willChangeTimeout = null;

  this.scroller = $element[0].getElementsByClassName('md-virtual-repeat-scroller')[0];
  this.sizer = this.scroller.getElementsByClassName('md-virtual-repeat-sizer')[0];
  this.offsetter = this.scroller.getElementsByClassName('md-virtual-repeat-offsetter')[0];

  this.handleScroll = this.handleScroll.bind(this, !!$attrs.mdHorizontal);

  $window.requestAnimationFrame(function() {
    this.size = $attrs.mdHorizontal ? $element[0].clientWidth : $element[0].clientHeight;
    this.repeater.containerUpdated();
  }.bind(this));
}

VirtualRepeatContainerController.prototype.register = function(repeaterCtrl) {
  this.repeater = repeaterCtrl;
  
  angular.element(this.scroller)
      .on('scroll wheel touchmove touchend', this.handleScroll)
      .on('scroll touchstart mouseenter', this.willChange.bind(this, true))
      .on('mouseleave', this.willChange.bind(this, false))
      .on('touchend', function() {
        this.$timeout.cancel(this.willChangeTimeout);
        this.willChangeTimeout = this.$timeout(
            this.willChange.bind(this, false), 0, false);
      }.bind(this));
};

VirtualRepeatContainerController.prototype.willChange = function(newSetting) {
  this.$timeout.cancel(this.willChangeTimeout);

  if (newSetting === this.offsetterWillChange) return;

  this.offsetterWillChange = newSetting;
  this.offsetter.style.willChange = newSetting ? 'transform' : 'auto';
};

VirtualRepeatContainerController.prototype.isHorizontal = function() {
  return !!$attrs.mdHorizontal;
};

VirtualRepeatContainerController.prototype.getSize = function() {
  return this.size;
};

VirtualRepeatContainerController.prototype.getScrollSize = function() {
  return this.scrollSize;
};

VirtualRepeatContainerController.prototype.setScrollSize = function(size) {
  if (this.scrollSize !== size) {
    this.$window.requestAnimationFrame(function() {
      this.sizer.style[this.$attrs.mdHorizontal ? 'width' : 'height'] = size + 'px';
    }.bind(this));
    this.scrollSize = size;
  }

  this.scrollSize = size;
};

VirtualRepeatContainerController.prototype.handleScroll = function(horizontal) {
  var NUM_EXTRA = 3;
  var transform;
  var oldOffset = this.scrollOffset;

  if (horizontal) {
    this.scrollOffset = this.scroller.scrollLeft;
    transform = 'translateX(';
  } else {
    this.scrollOffset = this.scroller.scrollTop;
    transform = 'translateY(';
  }

  if (oldOffset === this.scrollOffset) return;

  var itemSize = this.repeater.getSize();
  transform += (Math.max(0, this.scrollOffset - itemSize * NUM_EXTRA) - this.scrollOffset % itemSize) + 'px)';
  // this.offsetter.style.webkitTransform = transform;
  // this.offsetter.style.transform = transform;

  this.repeater.containerUpdated();
};

VirtualRepeatContainerController.prototype.getScrollOffset = function() {
  return this.scrollOffset;
};

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
        ctrl[0].link(ctrl[1], $transclude, lhs, rhs);
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
  // Possible TODO: measure height of first row from dom if not provided?
  this.itemSize = $scope.$eval($attrs.mdSize);
  this.blocks = {};
  this.pooledBlocks = [];
}

VirtualRepeatController.prototype.link = function(container, transclude, lhs, rhs) {
  this.container = container;
  this.transclude = transclude;
  this.lhs = lhs;
  this.rhs = rhs;
  this.sized = false;

  this.container.register(this);
};

VirtualRepeatController.prototype.containerUpdated = function() {
  var NUM_EXTRA = 3;

  if (!this.sized) {
    this.sized = true;
    this.$scope.$watchCollection(this.rhs, this.virtualRepeatUpdate.bind(this));
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
    this.virtualRepeatUpdate(this.items, this.items);
  }
};

VirtualRepeatController.prototype.virtualRepeatUpdate = function(items, oldItems) {
  this.items = items;
  this.parentNode = this.$element[0].parentNode;
  var i;

  this.container.setScrollSize((this.items ? this.items.length : 0) * this.itemSize);
  
  // Detach and pool any blocks that are no longer in the viewport.
  Object.keys(this.blocks).forEach(function(blockIndex) {
    var index = parseInt(blockIndex);
    if (index < this.newStartIndex || index > this.newEndIndex) {
      this.poolBlock(index);
    }
  }, this);

  // Add needed blocks.
  var newStartBlocks = [];
  var block;
  // For performance reasons, temporarily block browser url checks as we digest
  // the restored block scopes.
  this.$browser.$$checkUrlChange = angular.noop;
  for (i = this.newStartIndex; i < this.startIndex && this.blocks[i] == null; i++) {
    block = this.getBlock();
    this.updateBlock(block, i);
    newStartBlocks.push(block);
  }
  var newEndBlocks = [];
  for (i = this.endIndex; i < this.newEndIndex && this.blocks[i] == null; i++) {
    block = this.getBlock();
    this.updateBlock(block, i);
    newEndBlocks.push(block);
  }
  // Restore $$checkUrlChange.
  this.$browser.$$checkUrlChange = this.browserCheckUrlChange;

  // For now, use dom reordering to implement virtual scroll.
  // In the future, try out a transform-based cycle.
  // if (newStartBlocks.length) {
//     // this.$element.after(this.domFragmentFromBlocks(newStartBlocks));
//     this.parentNode.insertBefore(
//         this.domFragmentFromBlocks(newStartBlocks),
//         this.$element[0].nextSibling);
//   }
//   if (newEndBlocks.length) {
//     this.parentNode.appendChild(this.domFragmentFromBlocks(newEndBlocks));
//   }

  this.startIndex = this.newStartIndex;
  this.endIndex = this.newEndIndex;
};

VirtualRepeatController.prototype.getBlock = function() {
  if (this.pooledBlocks.length) {
    return this.pooledBlocks.pop();
  }

  var block;
  this.transclude(function(clone, scope) {
    block = {
      element: clone,
      scope: scope
    };
    this.parentNode.appendChild(clone[0]);
  }.bind(this));

  return block;
};

VirtualRepeatController.prototype.updateBlock = function(block, index) {
  block.scope.$index = index;
  block.scope[this.lhs] = this.items[index];
  this.blocks[index] = block;
  // block.element[0].style.top = index * this.itemSize + 'px';
  var transform = 'translateY(' + index * this.itemSize + 'px)';
  block.element[0].style.webkitTransform = transform;
  block.element[0].style.transform = transform;

  // Perform digest before reattaching the block.
  // Any resulting synchronous dom mutations should be much faster as a result.
  // This might break some directives, but I'm going to try it for now.
  block.scope.$digest();
};

VirtualRepeatController.prototype.poolBlock = function(index) {
  this.pooledBlocks.push(this.blocks[index]);
  // this.parentNode.removeChild(this.blocks[index].element[0]);
  this.blocks[index].element[0].style.webkitTransform = 'translateY(-1000px)';
  this.blocks[index].element[0].style.transform = 'translateY(-1000px)';
  delete this.blocks[index];
};

VirtualRepeatController.prototype.getSize = function() {
  return this.itemSize;
};

VirtualRepeatController.prototype.domFragmentFromBlocks = function(blocks) {
  var fragment = this.$document[0].createDocumentFragment();
  blocks.forEach(function(block) {
    fragment.appendChild(block.element[0]);
  });
  return fragment;
};
