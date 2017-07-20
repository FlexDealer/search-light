(function () {
  'use strict'

  /**
   * SearchLight
   * @module search-light
   */

  /** @typedef {Array|Object} Collection */

  /**
   * @typedef {Array} Match
   * @property {*} 0 - key
   * @property {number} 1 - relevance
   * @property {string} 2 - missing terms
   */

  /** @typedef {Match[]} Matches */

  /**
   * @typedef FilterObject
   * @type {Object}
   * @property {*} key - the property the filter applies to
   * @property {string} [operator='=='] - the comparison operator to use
   * @property {*} value - the value to check the items against
   */

  /**
   * @typedef {Array} FilterArray
   * @property {*} 0 - the property the filter applies to
   * @property {*} 1 - the comparison operator to use
   * @property {*} [2] - the value to check the items against
   * if only two elements, the second one is assumed to be the value and the operator is set to '=='
   */

  /** @typedef {(string|FilterArray|FilterObject)} Constraint */

  /**
   * @typedef {Object} NextIterator
   * @property {function} next - iterator function to use
   */

  /**
   * @callback SuccessCallback
   * @param {Object} results
   */

  /**
   * @callback FailureCallback
   * @param {Error} error
   */

  /**
   * @callback SortCallback
   * @param {Function} getItem
   * @param {Match} matchA
   * @param {Match} matchB
   */

  /**
   * @class
   * @memberof module:search-light
   */
  function SearchLight () {}

  SearchLight.prototype = {

    /**
     * Creates a new SearchLight instance and sets the collection
     * @memberof module:search-light.SearchLight
     * @static
     * @param {Collection} collection - Array or object of items or properties to search
     * @returns {SearchLight} instance - new SearchLight instance
     * @example
     * search( ['one', 'two', 'three'] )
     */
    search (items) {
      var sl = Object.create(SearchLight.prototype, {
        /**
         * State
         * @private
         */
        s_: {
          value: {
            matches: [],
            partial: [],
            allItems: [],
            searchText: '',
            searchTerms: [],
            keys: [],
            filters: [],
            threshold: 0,
            error: false,
            errorMessage: '',
            index: 0,
            lastIndex: 0,
            totalMatches: 0,
            ready: false,
            complete: false,
            searched: false
          }
        },

        /**
         * Options
         * @private
         */
        o_: {
          value: {
            collectionType: 'array',
            case: false,
            baseThreshold: 0,
            sort: false,
            customSort: null,
            inject: {
              property: 'searchResults',
              enabled: false
            }
          }
        }
      })

      return sl.fn_.collection_.call(sl, items)
    },

    /**
     * Set search terms or filters
     * @param {Constraint} constraint - Search text or filter to replace current constraints with
     * @returns {SearchLight}
     * @example
     * // sets the search text to be 'something'
     * search(collection).for('something')
     */
    for (constraint) {
      this.s_.searchText = ''
      this.s_.filters = []

      return this.and(constraint)
    },

    /**
     * Add additional search terms or filters
     * @param {Constraint} constraint - Search text or filter to replace current constraints with
     * @returns {SearchLight}
     * @example
     * // adds 'nothing' to the existing search text of 'something'
     * search(items).for('something').and('nothing')
     */
    and (constraint) {
      this.s_.ready = false
      this.s_.complete = false
      this.s_.searched = false

      if (typeof constraint === 'string') {
        this.s_.searchText = (
          this.s_.searchText + ' ' + constraint
        ).trim()
      } else if (typeof constraint === 'object') {
        var key, operator, value

        if (Array.isArray(constraint)) {
          key = constraint[0]
          operator = constraint[1]
          value = constraint[2]
        } else {
          key = constraint.key
          operator = constraint.operator
          value = constraint.value
        }

        if (typeof value === 'undefined') {
          value = operator
          operator = '=='
        }

        this.s_.filters.push([key, operator, value])
      } else {
        console.warn('Invalid constraint type: ', typeof constraint)
      }

      return this
    },

    /**
     * Set keys to search by
     * @param {(string|Array)} keys - key or array of keys
     * @returns {SearchLight}
     * @example
     * // sets keys to be ['an_object_property']
     * search(items).for('something').in('an_object_property')
     */
    in (keys) {
      this.s_.keys = []
      return this.or(keys)
    },

    /**
     * Add additional keys to search by
     * @param {(string|Array)} keys - key or array of keys
     * @returns {SearchLight}
     * @example
     * // adds 3 to existing array of keys ([1, 3])
     * search(items).for('something').in(1).or(3)
     */
    or (keys) {
      this.s_.ready = false
      this.s_.complete = false
      this.s_.searched = false

      if (typeof keys === 'string') {
        this.s_.keys.push(keys)
      } else {
        Array.prototype.push.apply(this.s_.keys, keys)
        // this.s_.keys.push(...keys)
      }

      return this
    },

    /**
     * Sets the sort setting to true
     * @returns {SearchLight}
     */
    sorted () {
      if (!this.o_.sort) {
        this.o_.sort = true
        this.s_.complete = false
      }

      return this
    },

    /**
     * Sets the sort setting to false
     * @returns {SearchLight}
     */
    unsorted () {
      if (this.o_.sort) {
        this.o_.sort = false
        this.s_.complete = false
      }

      return this
    },

    /**
     * Sets a custom sort function to use on the matches
     * @param {SortCallback}
     * @returns {SearchLight}
     */
    sortUsing (fn) {
      this.o_.customSort = fn
      this.s_.complete = false
      return this
    },

    /**
     * Sets the case-sensitive setting to true
     * @returns {SearchLight}
     */
    compareCase () {
      if (!this.o_.case) {
        this.o_.case = true
        this.s_.complete = false
        this.s_.searched = false
      }

      return this
    },

    /**
     * Sets the case-sensitive setting to false
     * @returns {SearchLight}
     */
    ignoreCase () {
      if (this.o_.case) {
        this.o_.case = false
        this.s_.complete = false
        this.s_.searched = false
      }

      return this
    },

    /**
     * Sets the inject.enabled setting to true and optionally sets the inject.property setting too
     * @param {*} [property] - the property stats are injected as
     * @returns {SearchLight}
     */
    withStats (property) {
      this.o_.inject.enabled = true

      if (typeof property !== 'undefined') {
        this.o_.inject.property = property
      }

      return this
    },

    /**
     * Sets the inject.enabled setting to false
     * @returns {SearchLight}
     */
    withoutStats () {
      this.o_.inject.enabled = false
      return this
    },

    /**
     * Promise support
     * Allows for asynchronous processing of large collections
     * @param {SuccessCallback} [success] - callback to run when/if promise completes successfully
     * @param {FailureCallback} [failure] - callback to run when/if promise completes unsuccessfully
     * @return {SearchLight}
     * @example
     * search(items).for('something')
     *              .then(
     *                  function(results) { console.log(results.matches) },
     *                  function(error) { console.log(error) }
     *              )
     */
    then (success, failure) {
      var promise = new Promise(function (resolve, reject) {
        this.fn_.updateMatches_.call(this)

        if (this.s_.error) {
          reject(Error(this.s_.errorMessage))
        } else {
          var sl = this
          resolve({
            get matches () { return sl.matches },
            get partialMatchess () { return sl.partialMatches },
            get allMatchess () { return sl.allMatches }
          })
        }
      }.bind(this))

      promise.then(success, failure)
      return this
    },

    /**
     * Allows promises to be written in a more readable format
     * @param {FailureCallback} failure - callback to run when/if promise completes unsuccessfully
     * @returns {SearchLight}
     * @example
     * search(items).for('something')
     *              .then((results) => do_something(results.matches))
     *              .catch((error) => { console.log(error) })
     */
    catch (failure) {
      return this.then(undefined, failure)
    },

    /**
     * Length of matches
     * @returns {Number} count - total number of matches
     */
    get length () {
      this.fn_.updateMatches_.call(this)
      return this.s_.totalMatches
    },

    /**
     * Gets all items that match all the constraints
     * @returns {Collection} items
     */
    get matches () {
      this.fn_.updateMatches_.call(this)
      var output = this.fn_.toOriginalFormat_.call(this, this.s_.matches)
      return output
    },

    /**
     * Gets all items that only match some of the constraints
     * @returns {Collection} items
     */
    get partialMatches () {
      this.fn_.updateMatches_.call(this)
      this.fn_.performSort_.call(this, this.s_.partial)

      return this.fn_.toOriginalFormat_.call(this, this.s_.partial)
    },

    /**
     * Gets all items that match any of the constraints
     * @returns {Collection} items
     */
    get allMatches () {
      this.fn_.updateMatches_.call(this)
      var allMatches = this.s_.matches.concat(this.s_.partial)
      this.fn_.performSort_.call(this, allMatches)

      return this.fn_.toOriginalFormat_.call(this, allMatches)
    },

    /**
     * Gets all items in the collection
     * @returns {Collection} matches
     */
    get allItems () {
      this.fn_.updateMatches_.call(this)
      this.fn_.performSort_.call(this, this.s_.allItems)

      return this.fn_.toOriginalFormat_.call(
        this,
        this.s_.allItems
      )
    },

    /**
     * Implements the iterable protocol
     * @memberof! module:search-light.SearchLight
     * @private
     * @name 'Symbol.iterator'
     * @returns {NextIterator}
     * @example
     * // outputs 'two' and 'three' to the dev console
     * for (var match in search( ['one', 'two', 'three'] ).for( 't' ) ) {
     *   console.log(match)
     * }
     */
    [Symbol.iterator] () {
      this.updateMatches_()

      if (this.o_.inject.enabled) {
        return { next: this.i_.nextInject_.bind(this) }
      } else {
        return { next: this.i_.next_.bind(this) }
      }
    },

    /**
     * @private
     * functions
     */
    fn_: {

      /**
       * Set the collection to be searched
       * @param {Collection} collection - Array or object of items or properties to search
       * @returns {SearchLight}
       * @example
       * search( ['one', 'two', 'three'] )
       */
      collection_ (collection) {
        var keys = []

        if (Array.isArray(collection)) {
          keys = Array.from(collection.keys())
        } else if (typeof collection === 'object') {
          keys = Object.keys(collection).filter(key => collection.hasOwnProperty(key))
          this.o_.collectionType = 'object'
        } else {
          this.s_.error = true
          this.s_.errorMessage = 'Invalid collection type: ' + typeof collection
          console.warn(this.s_.errorMessage)
        }

        this.s_.collection = new Map(
          keys.map(this.i_.collection_.bind(this, collection))
        )

        this.s_.complete = false
        this.s_.searched = false

        return this
      },

      /**
       * Sets up the search terms and calculates
       * the relevance of each item in the collection
       */
      performSearch_ () {
        // check if there are any constraints
        if (this.fn_.isConstrained.call(this)) {
          this.s_.allItems = []
          this.s_.matches = []
          this.s_.partial = []

          this.s_.collection.forEach(
            this.i_.calculateRelevance_.bind(this)
          )
        } else {
          // no constraints so the entire collection matches
          this.s_.allItems = Array.from(this.s_.collection.keys()).map(
            this.i_.emptyMatch_
          )

          this.s_.matches = this.s_.allItems
          this.s_.partial = []
        }

        this.s_.searched = true
      },

      /**
       * Searches and sorts items only if needed
       */
      updateMatches_ () {
        // do nothing if no changes to items or constraints
        if (!this.s_.complete) {
          if (!this.s_.searched) {
            this.fn_.performSearch_.call(this)
          }

          this.fn_.performSort_.call(this, this.s_.matches)

          this.s_.totalMatches = this.s_.matches.length
          this.s_.index = 0
          this.s_.lastIndex = this.s_.totalMatches - 1
          this.s_.complete = true
        }
      },

      /**
       * Sorts items if needed
       * @param {Matches} matches
       */
      performSort_ (matches) {
        if (
            this.o_.sort &&
            this.fn_.isConstrained.call(this) &&
            matches.length
        ) {
          matches.sort(this.i_.sortComparator_)
        }

        if (this.o_.customSort !== null) {
          matches.sort(this.o_.customSort.bind(null, this.fn_.getItem_.bind(this)))
        }
      },

      /**
       * Gets an item from the collection
       * @param {Match} match
       * @returns {*} item
       */
      getItem_ (match) {
        return this.s_.collection.get(match[0])
      },

      /**
       * Gets an item with stats injected
       * @param {Match} match
       * @returns {*} item
       */
      getItemInject_ (match) {
        var item = this.s_.collection.get(match[0])

        if (Array.isArray(item)) {
          item.push({ relevance: match[1], missing: match[2] })
        } else if (typeof item === 'object') {
          item[this.o_.inject.property] = {
            relevance: match[1],
            missing: match[2]
          }
        }

        return item
      },

      /**
       * Gets a subset of the collection and converts it to the same format it was added as
       * @param {Matches} matches
       * @returns {Collection} items
       */
      toOriginalFormat_ (matches) {
        if (this.o_.collectionType === 'array') {
          if (this.o_.inject.enabled) {
            return matches.map(this.fn_.getItemInject_, this)
          } else {
            return matches.map(this.fn_.getItem_, this)
          }
        } else {
          if (this.o_.inject.enabled) {
            return matches.reduce(
              this.i_.reduceInject_.bind(this),
              {}
            )
          } else {
            return matches.reduce(this.i_.reduce_.bind(this), {})
          }
        }
      },

      /**
       * Process and update search terms
       */
      updateConstraints_ () {
        if (!this.s_.ready) {
          if (this.s_.searchText === '') {
            this.s_.searchTerms = []
          } else {
            this.s_.searchTerms = (
              this.o_.case
                ? this.s_.searchText
                : this.s_.searchText.toLowerCase()
            ).split(' ')
          }

          this.s_.threshold = this.o_.baseThreshold + this.s_.filters.length + (this.s_.searchTerms.length > 0)

          this.s_.ready = true
        }
      },

      /**
       * Checks if there are any constraints
       * @returns {boolean} constrained
       */
      isConstrained () {
        // update constraints if needed
        this.fn_.updateConstraints_.call(this)
        return this.s_.searchTerms.length || this.s_.filters.length
      }

    },

    /**
     * @private
     * iterators
     */
    i_: {

      /**
       * Used to make an item for the collection
       * @param {Collection} collection
       * @param {*} key
       * @returns {Array} item
       */
      collection_ (collection, key) {
        return [ key, collection[key] ]
      },

      /**
       * Used to iterate through the matches
       * @returns {Object} iterator
       * @property {boolean} done
       * @property {*} [value]
       */
      next_ () {
        if (this.s_.index > this.s_.lastIndex) {
          return { done: true }
        } else {
          return {
            done: false,
            value: this.fn_.getItem_(this.s_.matches[ this.s_.index++ ])
          }
        }
      },

      /**
       * Used to iterate through the matches and inject the stats into each match
       * @returns {Object} iterator
       * @property {boolean} done
       * @property {*} [value]
       */
      nextInject_ () {
        if (this.s_.index > this.s_.lastIndex) {
          return { done: true }
        } else {
          return {
            done: false,
            value: this.fn_.getItemInject_(
              this.s_.matches[ this.s_.index++ ]
            )
          }
        }
      },

      /**
       * Used to build the searched string for each item in the collection
       * @param {Array|Object} item
       * @param {*} property
       * @returns {*} [value]
       */
      property_ (item, property) {
        return item[property] || null
      },

      /**
       * Checks each item in the collection against each search term
       * @param {Match} match
       * @param {string} subject
       * @param {string} term
       */
      search_ (match, subject, term) {
        var relevance = subject.split(term).length - 1
        if (relevance) {
          match[1] += relevance
        } else {
          match[2] += ' ' + term
        }
      },

      /**
       * Checks the appropriate property of each item in the collection
       * against each filter
       * @param {Array|Object} item
       * @param {Match} match
       * @param {FilterArray} filter
       */
      filter_ (item, match, filter) {
        var key = filter[0]
        var operator = filter[1]
        var value = filter[2]

        if (typeof item !== 'string') {
          switch (operator) {
            case '==' : match[1] += (item[ key ] == value); break // eslint-disable-line eqeqeq
            case '===' : match[1] += (item[ key ] === value); break

            case '!=' : match[1] += (item[ key ] != value); break // eslint-disable-line eqeqeq
            case '!==' : match[1] += (item[ key ] !== value); break

            case '>' : match[1] += (item[ key ] > value); break
            case '>=' : match[1] += (item[ key ] >= value); break

            case '<' : match[1] += (item[ key ] < value); break
            case '<=' : match[1] += (item[ key ] <= value); break

            default:
              console.warn('Invalid filter operator:', operator)
          }
        }
      },

      /**
       * Calculates the relevance of an item in the collection
       * against the filters and search terms
       * @param {*} item
       * @param {*} key
       */
      calculateRelevance_ (item, key) {
        var match = [key, 0, '']
        var subject = ''

        this.s_.filters.forEach(
          this.i_.filter_.bind(this, item, match)
        )

        if (typeof item === 'string') {
          // search entire string
          subject = item
        } else if (this.s_.keys.length) {
          // only search in given keys
          subject = this.s_.keys.map(
            this.i_.property_.bind(this, item)
          ).join('|')
        } else {
          // search in every enumerable property
          if (Array.isArray(item)) {
            subject = item.join('|')
          } else {
            subject = Object.keys(item).reduce(this.i_.reduceProperties_.bind(this, item), '')
          }
        }

        if (!this.o_.case) {
          subject = subject.toLowerCase()
        }

        this.s_.searchTerms.forEach(
          this.i_.search_.bind(this, match, subject)
        )

        // add matches to appropriate arrays
        this.s_.allItems.push(match)

        if (match[1] === 0) {
          // not a match
        } else if (match[1] < this.s_.threshold) {
          this.s_.partial.push(match) // below threshold
        } else {
          this.s_.matches.push(match) // above threshold
        }
      },

      /**
       * Creates an empty match
       * @param {*} key
       * @returns {Match} match
       */
      emptyMatch_ (key) {
        return [key, 0, '']
      },

      /**
       * Reduce iterator that converts the collection to an object
       * @param {Object} items - accumulator
       * @param {Match} match - currentValue
       * @returns {Object} items
       */
      reduce_ (items, match) {
        items[ match[0] ] = this.fn_.getItem_.call(this, match)
        return items
      },

      /**
       * Reduce iterator that converts the collection to an object with the
       * stats for each item injected
       * @param {Object} items - accumulator
       * @param {Match} match - currentValue
       * @returns {Object} items
       */
      reduceInject_ (items, match) {
        items[ match[0] ] = this.fn_.getItemInject_.call(this, match)
        return items
      },

      /**
       * Reduce iterator that creates a string of all enumerable properties of an object
       * @param {Object} item - item from the collection
       * @param {string} subject - accumulator
       * @param {*} key - currentValue
       * @returns {string} subject
       */
      reduceProperties_ (item, subject, key) {
        subject += ('|' + item[key])
        return subject
      },

      /**
       * Used for sorting the matches by relevance (highest relevance first)
       * If two items have equal relevance, it checks the original
       * insertion order to keep the sort stable
       * @param {Match} matchA
       * @param {Match} matchB
       * @returns {number} comparison - can be -1, 0, or 1
       */
      sortComparator_ (matchA, matchB) {
        if (matchB[1] > matchA[1]) {
          return 1
        } else if (matchB[1] === matchA[1]) {
          return matchB[0] < matchA[0]
        } else {
          return -1
        }
      }

    }

  }

  if (typeof window !== 'undefined') {
    window.searchLight = { search: SearchLight.prototype.search }
  }

  if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    /**
     * @function search
     * @static
     * @param {Collection} collection - Array or object of items or properties to search
     * @returns {SearchLight} instance - new SearchLight instance
     * @example
     * search(['one', 'two', 'three'])
     */
    module.exports.search = SearchLight.prototype.search
  }
})()
