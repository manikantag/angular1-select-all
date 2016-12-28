/**@preserve
 * angular1-select-all module.
 * @version 1.0.2
 * @link https://manikantag/github.io/angular1-select-all
 * @author Manikanta G
 * @license MIT License, http://www.opensource.org/licenses/MIT
 */
; (function() {
    'use strict';

    /**
     * Angular 1.x directive to handle checkbox 'Select All' functionality, with below support:
     *
     * - Checking/unchecking 'Select All' will make all member checkboxes to check/uncheck, and selected count will be updated.
     * - Checking/unchecking any member checkbox will checks/unchecks 'Select All' checkbox appropriately, and selected count will be updated.
     * 
     * <p>Note: Each member's <code>ng-model</code> should use <code>memberModelKey</code> property of
     * <code>mgCbSelectAllConfig</code> value object as checkbox model. Default is '<code>__selected</code>'</p>
     * @example
     * ```html
     * <div mg-cb-group>
     *     <label><input type="checkbox" ng-model="cb.selectAll" mg-cb-select-all="persons" mg-cb-selected-count="cb.selectedCount" > Select All</label>
     *     <button mg-cb-clear>Clear all</button>
     * 
     *     <p ng-repeat="person in persons">
     *         <label>
     *             <input type="checkbox" ng-model="person.__selected" mg-cb-member mg-cb-member-index="$index" > {{::person.name}} 
     *         </label>
     *     </p>
     * </div>
     * ```
     * @author Manikanta G
     */
    angular.module('angular1-select-all', [])

        .value('mgCbSelectAllConfig', {
            memberModelKey: '__selected'
        })


        /**
         * @ngdoc directive
         * @name mgCbGroup
         * @restrict EA
         * @description
         * <code>mg-cb-group</code> directive should be used on parent element which wraps
         * <code>mg-cb-select-all</code> and all <code>mg-cb-member</code> directives.
         * @scope
         */
        .directive('mgCbGroup', [ 'mgCbSelectAllConfig', function(mgCbSelectAllConfig) {
            return {
                scope: {
                    mgCbGroup: '='
                },
                restrict: 'AE',
                controller: ['$scope', function($scope) {
                    var callbackFn;

                    $scope.$on('$destroy', function() {
                        callbackFn = null;
                    });

                    return {
                        notify: function(memberElement, memberScope) {
                            callbackFn && callbackFn(memberElement, memberScope);
                        },
                        subscribe: function(cbFn) {
                            callbackFn = cbFn;
                        },
                        getMemberModelKey: function() {
                            return $scope.mgCbGroup && $scope.mgCbGroup.memberModelKey || mgCbSelectAllConfig.memberModelKey || '__selected';
                        }
                    };
                }]
            };
        }])


        /**
         * @ngdoc directive
         * @name mgCbSelectAll
         * @restrict EA
         * @description
         * <code>mg-cb-select-all</code> directive should be used with 'Select All' checkbox.
         * This will handle calculating the selected checkbox count and selecting/deselecting
         * member checkboxes.
         * This directive depends on element's <code>ng-model</code> and <code>mg-cb-group</code> on parent element.
         * @scope
         * - {Array|Object} mgCbSelectAll Array or Object which is used for all member checkboxes.
         * - {String} mgCbSelectedCount Scope property which will be updated with selected member checkbox count.
         */
        .directive('mgCbSelectAll', ['$timeout', function($timeout) {
            return {
                scope: {
                    mgCbSelectAll: '=', // Array or Object used in ng-repeat for all member checkboxes.
                    mgCbSelectedCount: '=', // Selected checkbox count.
                    ngModel: '=' // ng-model is required to restore it's original value from Object (set by mg-cb-member directive) to boolean.
                },
                restrict: 'AE',
                require: ['ngModel', '^mgCbGroup'],
                link: function(scope, element, attr, controllers) {

                    var ngModelCtrl = controllers[0],
                        mgCbGroupCtrl = controllers[1],
                        init = true;

                    var memberModelKey = mgCbGroupCtrl.getMemberModelKey();

                    console.debug("mgCbSelectAll: Using '%s' as memberModelKey", memberModelKey);

                    // Set the selected checkbox count initially.
                    $timeout(function() {
                        scope.mgCbSelectedCount = getSelectedCount();
                    });

                    mgCbGroupCtrl.subscribe(function(memberElement, memberScope) {
                        console.debug('mgCbSelectAll: subscribe(): new event', memberElement, memberScope);

                        // Reset the mgCbSelectAll ng-model value to boolean from Object.
                        // http://stackoverflow.com/a/31827383/340290
                        scope.$apply(function() {
                            // ngModelCtrl.$modelValue = {bymgCbMember: true};
                            scope.ngModel = { bymgCbMember: true };
                        });

                    });

                    // View value is changed (i.e., checkbox value is changed) --> cascade this change to all member checkboxes.
                    ngModelCtrl.$parsers.push(function(viewValue) {
                        if (!init) {
                            console.debug('mgCbSelectAll: $parsers(): view value changed to %s --> updating all checkboxes', viewValue);
                            cacscadeSelectAllToAllChecboxes(viewValue);
                        }

                        init && (init = false);

                        return viewValue;
                    });

                    // Model value is changed (this could be from controller)
                    ngModelCtrl.$formatters.push(function(modelValue) {

                        // If this is the first time this $formatter being invoked (which means this directive 
                        // is just initialised), or if this ng-model is 'true' (which Indicates the 'Select All' 
                        // checkbox is selected initially), then only do the required stuff.
                        if (modelValue || !init) {

                            // If the modelValue is an object instead of boolean, this model change is triggered due to 
                            // the member checkbox change (see mg-cb-member/mg-cb-clear directive) --> just re-calculate the selected 
                            // count. Do NOT cascade this change to all member checkboxes (which will cause recursive unchecks).
                            if (angular.isObject(modelValue) && modelValue.bymgCbMember) {
                                console.debug('mgCbSelectAll: $formatters(): model value changed to %s by mg-cb-member/mg-cb-clear directive --> re-calculating selected count', modelValue);

                                scope.mgCbSelectedCount = getSelectedCount();

                                // 'Select All' is checked when the checked count is same as the total members count.
                                modelValue = scope.mgCbSelectAll.length ? scope.mgCbSelectedCount === scope.mgCbSelectAll.length : false;

                                // Reset the mgCbSelectAll ng-model value to boolean from Object.
                                // http://stackoverflow.com/a/31827383/340290
                                ngModelCtrl.$modelValue = modelValue;
                                scope.ngModel = modelValue;
                            } else {
                                console.debug('mgCbSelectAll: $formatters(): model value changed to %s --> updating all checkboxes', modelValue);

                                // This model change is not triggered by the member checkbox --> cascade this change to all member checkboxes.
                                cacscadeSelectAllToAllChecboxes(modelValue);
                            }
                        }

                        init && (init = false);

                        return modelValue;
                    });

                    scope.$watch('mgCbSelectAll.length', function(newLength) {
                        console.debug('mgCbSelectAll: $watch(): mgCbSelectAll array length changed to: %i', newLength);

                        // UPDATE: DO NOT DO THIS: This is clearing the selected checkbox too.
                        // scope.mgCbSelectedCount = getSelectedCount();
                        // ngModelCtrl.$setViewValue(scope.mgCbSelectAll.length && scope.mgCbSelectedCount === scope.mgCbSelectAll.length);

                        // Inform the $formatter to recalcuate the selected count. Workaround for the above issue.
                        scope.ngModel = { bymgCbMember: true };

                        ngModelCtrl.$render();
                    });

                    // Checks/unchecks all the member checkboxes & updates the selected count.
                    function cacscadeSelectAllToAllChecboxes(isSelectedAll) {
                        var i,
                            membersCnt = scope.mgCbSelectAll.length;

                        for (i = 0; i < membersCnt; i++) {
                            scope.mgCbSelectAll[i][memberModelKey] = isSelectedAll;
                        }

                        scope.mgCbSelectedCount = isSelectedAll ? membersCnt : 0;
                    }

                    // Returns currently selected member checkboxes count.
                    function getSelectedCount() {
                        var i,
                            membersCnt = scope.mgCbSelectAll.length,
                            count = 0;

                        for (i = 0; i < membersCnt; i++) {
                            if (scope.mgCbSelectAll[i][memberModelKey]) {
                                count++;
                            }
                        }

                        return count;
                    }
                }
            };
        }])


        /**
         * @ngdoc directive
         * @name mgCbMember
         * @restrict EA
         * @description
         * <code>mg-cb-member</code> directive should be used with each member checkbox.
         * <p>This directive depends on element's <code>ng-model</code> and <code>mg-cb-group</code> on parent element.
         * This will communicates with <code>mg-cb-group</code> directive, which will
         * notify the <code>mg-cb-select-all</code> directive to re-calculate the selected count.</p>
         * @scope
         * @param {Number} mgCbMemberIndex (Optional) Member index for logging purpose.
         */
        .directive('mgCbMember', ['$parse', '$timeout', function($parse, $timeout) {
            return {
                scope: {},
                restrict: 'AE',
                require: ['ngModel', '^mgCbGroup'],
                link: function(scope, element, attr, controllers) {
                    var ngModelCtrl = controllers[0],
                        memberIndex = -1,
                        mgCbGroupCtrl = controllers[1];

                    if (attr.mgCbMemberIndex) {
                        memberIndex = $parse(attr.mgCbMemberIndex)(scope.$parent);
                    }

                    // View value is changed (i.e., checkbox value is changed) --> Notify mg-cb-group 
                    // as mg-cb-select-all need to update it's model and re-calculate the selected count. 
                    ngModelCtrl.$parsers.push(function(viewValue) {
                        console.debug('mgCbMember %i: $parsers(): view value changed to %s --> notifying mg-cb-group', memberIndex, viewValue);
                        $timeout(function() {
                            mgCbGroupCtrl.notify('mgCbMember');
                        });
                        return viewValue;
                    });

                }
            };
        }])


        /**
         * @ngdoc directive
         * @name mgCbClear
         * @restrict EA
         * @description
         * <code>mg-cb-clear</code> directive is used to clear all the selected checkboxes.
         * @scope
         * - {Array|Object} mgCbClear Array or Object which is used for all member checkboxes.
         */
        .directive('mgCbClear', [ function() {
            return {
                scope: {
                    mgCbMembers: '=mgCbClear' // Array or Object used in ng-repeat for all member checkboxes.
                },
                restrict: 'AE',
                require: ['^mgCbGroup'],
                link: function(scope, element, attr, controllers) {
                    var mgCbGroupCtrl = controllers[0];

                    var memberModelKey = mgCbGroupCtrl.getMemberModelKey();

                    if (!scope.mgCbMembers) {
                        console.warn('mgCbClear: mg-cb-members collection is not passed. Not initialising the directive.');
                        return;
                    }

                    element.on('click', function() {
                        var mgCbMembers = scope.mgCbMembers,
                            membersCnt = mgCbMembers.length,
                            i;

                        scope.$apply(function() {
                            for (i = 0; i < membersCnt; i++) {
                                mgCbMembers[i][memberModelKey] && (mgCbMembers[i][memberModelKey] = false);
                            }
                        });

                        mgCbGroupCtrl.notify('mgCbClear');

                    });

                }
            };
        }])
        ;

})();