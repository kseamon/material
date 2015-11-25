(function () {
  'use strict';

    angular
      .module('virtualRepeatTestCaseNgClassRepeat', ['ngMaterial'])
      .controller('AppCtrl', function() {
        this.cols = [];

        this.openCol = function(curCol, number) {
          curCol.chosenItem = number;

          var curColIndex = this.cols.indexOf(curCol);
          this.cols.length = curColIndex + 1;

          this.cols.push(createCol(number));
        };
        
        this.cols.push(createCol(0));

        function createCol(multiple) {
          var col = {items: []};
          for (var i = 0; i < 200; i += 1 + multiple) {
            col.items.push(i);
          }
          return col;
        };
      });

})();
