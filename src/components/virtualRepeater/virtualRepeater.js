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

function VirtualRepeatContainerController($scope, $element, $attrs, $window) {
  this.$scope = $scope;
  this.$element = $element;
  this.$attrs = $attrs;
  this.$window = $window;

  this.size = 0;
  this.scrollSize = 0;
  this.scrollOffset = 0;
  this.repeater = null;

  this.scroller = $element[0].getElementsByClassName('md-virtual-repeat-scroller')[0];
  this.sizer = this.scroller.getElementsByClassName('md-virtual-repeat-sizer')[0];
  this.offsetter = this.scroller.getElementsByClassName('md-virtual-repeat-offsetter')[0];

  $window.requestAnimationFrame(function() {
    this.size = $attrs.mdHorizontal ? $element[0].clientWidth : $element[0].clientHeight;
    this.repeater.containerUpdated();
  }.bind(this));

  this.frame = null;
  angular.element(this.scroller)
      .on('scroll', function(evt) {
        if (!this.repeater || this.frame) return;

        this.frame = $window.requestAnimationFrame(function() {
          this.frame = null;

          var transform;
          if ($attrs.mdHorizontal) {
            this.scrollOffset = this.scroller.scrollLeft;
            transform = 'translateX(';
          } else {
            this.scrollOffset = this.scroller.scrollTop;
            transform = 'translateY(';
          }
          transform += (this.scrollOffset - this.scrollOffset % this.repeater.getSize()) + 'px)';
          this.offsetter.style.webkitTransform = transform;
          this.offsetter.style.transform = transform;

          this.repeater.containerUpdated();
        }.bind(this));
      }.bind(this));
}

VirtualRepeatContainerController.prototype.register = function(repeaterCtrl) {
  this.repeater = repeaterCtrl;
};

VirtualRepeatContainerController.prototype.isHorizontal = function() {
  return !!$attrs.mdHorizontal;
};

VirtualRepeatContainerController.prototype.getSize = function() {
  return this.size;
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

function VirtualRepeatController($scope, $element, $attrs, $document) {
  this.$scope = $scope;
  this.$element = $element;
  this.$attrs = $attrs;
  this.$document = $document;

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
  if (!this.sized) {
    this.sized = true;
    this.$scope.$watchCollection(this.rhs, this.virtualRepeatUpdate.bind(this));
    this.items = this.rhs(this.$scope);
  }

  this.virtualRepeatUpdate(this.items, this.items);
};

VirtualRepeatController.prototype.virtualRepeatUpdate = function(items, oldItems) {
  this.items = items;
  var itemsLength = items ? items.length : 0;
  var containerLength = Math.ceil(this.container.getSize() / this.itemSize);
  var newStartIndex = Math.max(0, Math.min(
          itemsLength - containerLength,
          Math.floor(this.container.getScrollOffset() / this.itemSize)));
  var newEndIndex = Math.min(itemsLength, newStartIndex + containerLength + 1);
  var i;

  this.container.setScrollSize(itemsLength * this.itemSize);
  
  Object.keys(this.blocks).forEach(function(blockIndex) {
    var index = parseInt(blockIndex);
    if (index < newStartIndex || index > newEndIndex) {
      this.poolBlock(index);
    }
  }, this);

  // Add needed elements.
  var newStartBlocks = [];
  var block;
  for (i = newStartIndex; i < this.startIndex && this.blocks[i] == null; i++) {
    block = this.getBlock();
    this.updateBlock(block, i);
    newStartBlocks.push(block);
  }
  var newEndBlocks = [];
  for (i = this.endIndex; i < newEndIndex && this.blocks[i] == null; i++) {
    block = this.getBlock();
    this.updateBlock(block, i);
    newEndBlocks.push(block);
  }

  // For now, use dom reordering to implement virtual scroll.
  // In the future, try out a transform-based cycle.
  if (newStartBlocks.length) {
    this.$element.after(this.domFragmentFromBlocks(newStartBlocks));
  }
  if (newEndBlocks.length) {
    this.$element[0].parentNode.appendChild(this.domFragmentFromBlocks(newEndBlocks));
  }

  this.startIndex = newStartIndex;
  this.endIndex = newEndIndex;
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
  });

  return block;
};

VirtualRepeatController.prototype.updateBlock = function(block, index) {
  block.scope.$index = index;
  block.scope[this.lhs] = this.items[index];
  this.blocks[index] = block;

  // Perform digest before reattaching the block.
  // This might break some directives, but I'm going to try it for now.
  block.scope.$digest();
};

VirtualRepeatController.prototype.poolBlock = function(index) {
  this.pooledBlocks.push(this.blocks[index]);
  this.blocks[index].element.detach();
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
