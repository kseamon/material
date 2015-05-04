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
    template: VirtualRepeatContainerTemplate,
    terminal: true
  };
}

function VirtualRepeatContainerTemplate($element, $attr) {
  return '<div class="md-virtual-repeat-container ' +
      ($attr.mdHorizontal ? 'md-horizontal' : 'md-vertical') + '">' +
    '<div class="md-virtual-repeat-scroller">' +
      '<div class="md-virtual-repeat-sizer"></div>' +
      '<div class="md-virtual-repeat-offsetter"></div>' +
        $element[0].innerHTML +
      '</div>' +
    '</div>' +
  '</div>';
}

function VirtualRepeatContainerController($scope, $element, $attr, $window) {
  this.$scope = $scope;
  this.$element = $element;
  this.$attr = $attr;
  this.$window = $window;

  this.size = 0;
  this.scrollSize = 0;
  this.scrollOffset = 0;
  this.repeater = null;

  this.scroller = $element[0].getElementsByClassName('md-virtual-repeat-scroller')[0];
  this.sizer = this.scroller.getElementsByClassName('md-virtual-repeat-sizer')[0];
  this.offsetter = this.scroller.getElementsByClassName('md-virtual-repeat-ofsetter')[0];

  $window.requestAnimationFrame(function() {
    this.size = $attr.mdHorizontal ? $element[0].clientWidth : $element[0].clientHeight;
  }.bind(this));

  angular.element(this.scroller)
      .on('scroll', function(evt) {console.log(evt);
        if (!this.repeater) return;
        // TODO: requestAnimationFrame
        var transform;
        if ($attr.mdHorizontal) {
          this.scrollOffset = this.scroller.scrollLeft;
          transform = 'translateX(';
        } else {
          this.scrollOffset = this.scroller.scrollTop;
          transform = 'translateY(';
        }
        transform += this.scrollOffset % this.repeater.getSize() + 'px)';
        this.offsetter.style.webkitTransform = transform;
        this.offsetter.style.transform = transform;

        this.repeater.containerUpdated();
      }.bind(this))
      .on('wheel', function(evt) {
        if ($attr.mdHorizontal) {
          this.scroller.scrollLeft = this.scrollOffset + evt.deltaX;
        } else {
          this.scroller.scrollTop = this.scrollOffset + evt.deltaY;
        }

        evt.preventDefault();
      }.bind(this));
}

VirtualRepeatContainerController.prototype.register = function(repeaterCtrl) {
  this.repeater = repeaterCtrl;
};

VirtualRepeatContainerController.prototype.isHorizontal = function() {
  return !!$attr.mdHorizontal;
};

VirtualRepeatContainerController.prototype.getSize = function() {
  return this.size;
};

VirtualRepeatContainerController.prototype.setScrollSize = function(size) {
  if (this.scrollSize !== size) {
    this.$window.requestAnimationFrame(function() {
      this.sizer.style[this.$attr.mdHorizontal ? 'width' : 'height'] = size + 'px';
    }.bind(this));
    this.scrollSize = size;
  }

  this.scrollSize = size;
};

function VirtualRepeatDirective() {
  return {
    controller: VirtualRepeatController,
    priority: 1000,
    require: ['^mdVirtualRepeatContainer'],
    restrict: 'A',
    terminal: true,
    transclude: 'element',
    compile: function VirtualRepeatCompile($element, $attr) {
      var expression = $attr.ngRepeat;
      var match = expression.match(/^\s*([\s\S]+?)\s+in\s+([\s\S]+?)\s*$/);
      var lhs = match[1];
      var rhs = match[2];

      return function VirtualRepeatLink($scope, $element, $attr, ctrl, $transclude) {
        ctrl[0].link(ctrl[1], $transclude);
      };
    }
  };
}

function VirtualRepeatController($scope, $element, $attr) {
  this.$scope = $scope;
  this.$element = $element;
  this.$attr = $attr;

  // Will probably need some way of getting this from the dom/theme/etc.
  this.firstItemOffset = 0;
  this.startIndex = 0;
  this.endIndex = 0;
  // Possible TODO: measure height of first row from dom if not provided?
  this.itemSize = $scope.$eval($attr.mdSize);
  this.blocks = {};
  this.pooledBlocks = [];
}

VirtualRepeatController.prototype.link = function(container, transclude, itemSizeExpr) {
  this.container = container;
  this.transclude = transclude;

  this.$scope.$watchCollection(rhs, this.virtualRepeatUpdate.bind(this));
};

VirtualRepeatController.prototype.containerUpdated = function() {
  this.virtualRepeatUpdate(this.items, this.items);
};

VirtualRepeatController.prototype.virtualRepeatUpdate = function(items, oldItems) {
  var newStartIndex = this.container.getScrollOffset() % this.itemSize;
  var newEndIndex = newStartIndex + container.getSize() % this.itemSize;
  var i;
  
  // Remove and pool leftover elements.
  for (i = this.startIndex; i < newStartIndex; i++) {
    this.poolBlock(i);
  }
  for (i = newEndIndex; i < endIndex; i++) {
    this.poolBlock(i);
  }
  
  // Add needed elements.
  var newStartBlocks = [];
  var block;
  for (i = newStartIndex; i < newEndIndex && this.scopes[i] == null; i++) {
    block = this.getBlock();
    this.updateBlock(block, index);
    newStartBlocks.push(block);
  }
  var newEndBlocks = [];
  for (i = newEndIndex; i > newEndIndex && this.scopes[i] == null; i++) {
    block = this.getBlock();
    this.updateBlock(block, index);
    newEndBlocks.push(block);
  }

  // For now, use dom reordering to implement virtual scroll.
  // In the future, try out a transform-based cycle.
  var fragment;
  if (newStartBlocks.length) {
    fragment = this.$document[0].createDocumentFragment();
    newStartBlocks.forEach(fragment.appendChild.bind(fragment));
    this.container.offsetter.insertBefore(fragment, this.container.offsetter.firstChild);
  }
  if (newEndBlocks.length) {
    fragment = this.$document[0].createDocumentFragment();
    newEndBlocks.forEach(fragment.appendChild.bind(fragment));
    this.container.offsetter.appendChild(fragment);
  }
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
  block.scope[this.lhs] = this.rhs[index];
  this.blocks[index] = block;

  // Perform digest before reattaching the block.
  // This might break some directives, but I'm going to try it for now.
  block.scope.$digest();
};

VirtualRepeatController.prototype.poolBlock = function(block, index) {
  this.pooledBlocks.push(this.blocks[i]);
  this.blocks[i].element.detach();
  delete this.blocks[i];
};

VirtualRepeatController.prototype.getSize = function() {
  return this.itemSize;
};
