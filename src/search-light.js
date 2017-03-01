// Search Light
let SearchLight = {

  // INTERNAL PROPERTIES

  /// State
  state_: {
    matches: [],
    partial: [],
    allItems: [],
    searchText: '',
    searchTerms: [],
    properties: [],
    filters: [],
    error: false,
    errorMessage: '',
    index: 0,
    lastIndex: 0,
    totalMatches: 0,
    ready: false,
    complete: false,
    searched: false
  },

  /// Settings
  settings_: {
    collectionType: 'array',
    comparison: {
      case: false,
       // add fuzzy searching?
    },
    relevance: {
      threshold: 1,
      sort: false,
    },
    inject: {
      property: 'searchResults',
      relevance: false,
      missingTerms: false
    }
  },

  // END INTERNAL PROPERTIES


  // PUBLIC FUNCTIONS

  /// INITIALIZATION

  //// Set up collection of items
  //// Ex: search( ['one', 'two', 'three'] );
  search_: function(items) {
    let keys = [];

    if (Array.isArray(items)) {
      keys = [...items.keys()];

    } else if (typeof items === 'object') {
      keys = Object.keys( items ).filter( key => items.hasOwnProperty(key) );
      this.settings_.collectionType = 'object';

    } else {
      this.state_.error = true;
      this.state_.errorMessage = 'Invalid items type: ', typeof items;
      console.warn( this.state_.errorMessage );
    }

    console.log(this);

    this.state_.collection = new Map(
      keys.map( (key) => [ key, items[key] ] )
    );

    this.state_.complete = false;
    this.state_.searched = false;

    return this;
  },

  /// END INITIALIZATION


  /// CONSTRAINTS

  //// Add search terms or filters
  //// Ex: search(collection).for('something')
  for: function (constraint) {
    this.state_.ready = false;
    this.state_.complete = false;
    this.state_.searched = false;

    if (typeof constraint === 'string') {
      this.state_.searchText = (
        this.state_.searchText + ' ' + constraint
      ).trim();

    } else if (typeof constraint === 'object') {
      let key, operator, value;

      if (Array.isArray(constraint)) {
        [key, operator, value] = constraint;
      } else {
        ({key, operator, value} = constraint);
      }

      if (typeof value === 'undefined') {
        value = operator;
        operator = '==';
      }

    } else {
      console.warn( 'Invalid constraint type: ', typeof constraint );
    }

    return this;
  },

  //// Alias for .for()
  //// Ex: search(items).for(['a_property', '>=', 5]).and('something else');
  and: function(constraint) {
    return this.for( constraint );
  },

  //// Narrow down properties to search in
  //// Ex: search(items).for('something').in('an_object_property');
  in: function(properties) {
    this.state_.ready = false;
    this.state_.complete = false;
    this.state_.searched = false;

    if (typeof properties === 'string') {
      this.state_.properties.push( properties );
    } else {
      this.state_.properties.push( ...properties );
    }

    return this;
  },
  //// Alias for .in()
  //// Ex: search(items).for('something').in(1).or(3)
  or(properties) {
    return this.in(properties)
  },

  //// Set sorting option
  sortedBy(method) {
    this.state_.complete = false;

    if (method === 'relevance') {
      this.settings_.relevance.sort = true;
    } else {
      this.settings_.relevance.sort = false;
    }

    return this;
  },

  /// END CONSTRAINTS


  /// PROMISE SUPPORT

  //// Allows for asynchronous processing of large collections
  //// Ex: search(items).for('something')
  ////                  .then(
  ////                    (results) => do_something(results.matches),
  ////                    (error) => { console.log(error); }
  ////                  );
  then(success, failure) {
    let promise = new Promise((function(resolve, reject) {
      this.functions_.updateMatches_.call(this);

      if (this.state_.error) {
        reject(Error(this.state_.errorMessage));
      } else {
        resolve({
          matches: this.matches,
          partialMatches: this.partialMatches,
          allMatches: this.allMatches
        });
      }
    }).bind(this));

    promise.then(success, failure);
    return this;
  },
  //// Convenience function that allows you to use promises like this:
  //// Ex: search(items).for('something')
  ////                  .then((results) => do_something(results.matches))
  ////                  .catch((error) => { console.log(error); });
  catch(failure) {
    return this.then(undefined, failure);
  },

  /// END PROMISE SUPPORT

  // END PUBLIC FUNCTIONS



  // INTERNAL FUNCTIONS

  /// ITERABLE AND ITERATOR INTERFACES
  /// Ex: outputs 'two' and 'three' to the dev console
  /// for (let match in search( ['one', 'two', 'three'] ).for( 't' ) ) {
  ///   console.log(match);
  /// }

  //// Implement the iterable protocol
  [Symbol.iterator]() {
    this.updateMatches_();

    // doing these operations here instead of inside the loop (premature optimization!!!)
    if (this.settings_.inject.relevance && this.settings_.inject.missingTerms) {
      return { next: this.nextIteratorInjectAll_.bind(this) };

    } else if (this.settings_.inject.relevance) {
      return { next: this.nextIteratorInjectRelevance_.bind(this) };

    } else if (this.settings_.inject.missingTerms) {
      return { next: this.nextIteratorInjectMissingTerms_.bind(this) };

    } else {
      return { next: this.nextIterator_.bind(this) };
    }
  },

  functions_: {
    //// ITERATOR PROTOCOL

    ///// Basic variation
    nextIterator_() {
      if (this.state_.index > this.state_.lastIndex) {
        return { done: true };
      } else {
        return {
          done: false,
          value: this.functions_.getItem_( this.state_.matches[ this.state_.index++ ] )
        };
      }
    },

    ///// ITERATOR VARIATIONS (for different settings)
    nextIteratorInjectAll_() {
      if (this.state_.index > this.state_.lastIndex) {
        return { done: true };
      } else {
        return {
          done: false,
          value: this.functions_.getItemInjectAll_(
            this.state_.matches[ this.state_.index++ ]
          )
        };
      }
    },

    nextIteratorInjectRelevance_() {
      if (this.state_.index > this.state_.lastIndex) {
        return { done: true };
      } else {
        return {
          done: false,
          value: this.functions_.getItemInjectRelevance_(
            this.state_.matches[ this.state_.index++ ]
          )
        };
      }
    },

    nextIteratorInjectMissingTerms_() {
      if (this.state_.index > this.state_.lastIndex) {
        return { done: true };
      } else {
        return {
          done: false,
          value: this.functions_.getItemInjectMissingTerms_(
            this.state_.matches[ this.state_.index++ ]
          )
        };
      }
    },
    ///// END ITERATOR VARIATIONS

    /// END ITERABLE AND ITERATOR INTERFACES


    /// ITERATORS (anonymous functions use more memory)

    //// Used to build the searched string for each item in the collection
    propertyIterator_(item, property) {
      return item[property] || null;
    },

    //// Checks each item in the collection against each search term
    searchIterator_(match, subject, term) {
      let relevance = subject.split( term ).length - 1;
      if (relevance) {
        match[1] += relevance;
      } else {
        match[2] += ' ' + term;
      }
    },

    //// Checks the appropriate property of each item in the collection
    //// against each filter
    filterIterator_(item, match, filter) {
      let key = filter[0],
          operator = filter[1],
          value = filter[2];

      if (typeof item !== 'string') {

        switch (operator) {
          case '==' : match[1] += (item[ key ] ==  value); break;
          case '===': match[1] += (item[ key ] === value); break;

          case '!=' : match[1] += (item[ key ] !=  value); break;
          case '!==': match[1] += (item[ key ] !== value); break;

          case '>'  : match[1] += (item[ key ] >   value); break;
          case '>=' : match[1] += (item[ key ] >=  value); break;

          case '<'  : match[1] += (item[ key ] <   value); break;
          case '<=' : match[1] += (item[ key ] <=  value); break;

          default:
            console.warn( 'Invalid filter operator:', operator );
        }

      }
    },

    //// Calculates the relevance of each item in the collection
    //// against the filters and search terms
    checkRelevance_(item, key) {
      let match = [key, 0, ''],
          subject = '';

      this.state_.filters.forEach(
        this.functions_.filterIterator_.bind(this, item, match)
      );

      if (typeof item === 'string') {
        // search entire string
        subject = item;

      } else if (this.state_.properties.length) {
        // only search in given properties
        subject = this.state_.properties.map(
          this.functions_.propertyIterator_.bind(this, item)
        ).join('|');

      } else {
        // search in every enumerable property
        if (Array.isArray(item)) {
          subject = item.join('|');
        } else {
          subject = Object.values(item).join('|');
        }
      }

      if (!this.settings_.comparison.case) {
        subject = subject.toLowerCase();
      }

      this.state_.searchTerms.forEach(
        this.functions_.searchIterator_.bind(this, match, subject)
      );

      // add matches to appropriate arrays
      this.state_.allItems.push( match );

      if (match[1] === 0) {
        // not a match
      } else if (match[1] < this.settings_.relevance.threshold) {
        this.state_.partial.push( match ); // below threshold

      } else {
        this.state_.matches.push( match ); // above threshold
      }
    },

    //// Used to create empty match items when there are no constraints
    emptyMatchIterator_(key) {
      return [key, 0, ''];
    },

    //// Used for sorting the matches by relevance (highest relevance first)
    //// If two items have equal relevance,
    //// it checks the original order to keep the sort stable
    sortComparator_(a, b) {
      if (b[1] > a[1]) {
        return 1;
      } else if (b[1] === a[1]) {
        return b[0] < a[0];
      } else {
        return -1
      }
    },

    /// END ITERATORS


    /// COLLECTION PROCESSING

    //// Sets up the search terms and calculates
    //// the relevance of each item in the collection
    performSearch_() {
      // check if there are any constraints
      if (this.functions_.isConstrained.call(this)) {
        this.state_.allItems = [];
        this.state_.matches = [];
        this.state_.partial = [];

        this.state_.collection.forEach(
          this.functions_.checkRelevance_.bind(this)
        );

      } else {
        // no constraints so the entire collection matches
        this.state_.allItems = Array.from(this.state_.collection.keys()).map(
          this.functions_.emptyMatchIterator_
        );

        this.state_.matches = this.state_.allItems;
        this.state_.partial = [];
      }

      this.state_.searched = true;
    },

    //// Searches and sorts items only if needed
    updateMatches_() {
      // do nothing if no changes to items or constraints
      if (!this.state_.complete) {

        if (!this.state_.searched) {
          this.functions_.performSearch_.call(this);
        }

        this.functions_.performSort_.call(this, this.state_.matches);

        this.state_.totalMatches = this.state_.matches.length;
        this.state_.index = 0;
        this.state_.lastIndex = this.state_.totalMatches - 1;
        this.state_.complete = true;
      }

      return this;
    },

    //// Sorts items if needed
    performSort_(items) {
      if (
          this.settings_.relevance.sort &&
          this.functions_.isConstrained.call(this) &&
          items.length
      ) {
        items.sort(this.functions_.sortComparator_);
      }
    },

    /// END COLLECTION PROCESSING


    /// HELPER FUNCTIONS

    //// Returns the item
    getItem_(match) {
      return this.state_.collection.get( match[0] );
    },

    //// GET ITEM VARIATIONS

    ///// Returns the item with all info injected
    getItemInjectAll_(match) {
      let item = this.state_.collection.get( match[0] );

      if (Array.isArray(item)) {
        item.push({ relevance: match[1], missing: match[2] });

      } else if (typeof item === 'object') {
        item[this.settings_.inject.property] = {
          relevance: match[1], missing: match[2]
        };

      } else {
        return item;
      }
    },

    ///// Returns the item with their relevance injected
    getItemInjectRelevance_(match) {
      let item = this.state_.collection.get( match[0] );

      if (Array.isArray(item)) {
        item.push({ relevance: match[1] });

      } else if (typeof item === 'object') {
        item[this.settings_.inject.property] = { relevance: match[1] };

      } else {
        return item;
      }
    },

    ///// Returns the item with their missing terms injected
    getItemInjectMissingTerms_(match) {
      let item = this.state_.collection.get( match[0] );

      if (Array.isArray(item)) {
        item.push({ missing: match[2] });
      } else if (typeof item === 'object') {
        item[this.settings_.inject.property] = { missing: match[2] };
      } else {
        return item;
      }
    },

    //// END GET ITEM VARIATIONS


    //// Return items as the same type of collection they were originally
    toOriginalFormat_(matches) {
      if (this.settings_.collectionType === 'array') {

        // doing these operations here instead of inside the loop (premature optimization!!!)
        if (this.settings_.inject.relevance && this.settings_.inject.missingTerms) {
          return matches.map( this.functions_.getItemInjectAll_.bind(this) );

        } else if (this.settings_.inject.relevance) {
          return matches.map( this.functions_.getItemInjectRelevance_.bind(this) );

        } else if (this.settings_.inject.missingTerms) {
          return matches.map( this.functions_.getItemInjectMissingTerms_.bind(this) );

        } else {
          return matches.map( this.functions_.getItem_.bind(this) );
        }

      } else {
        let items = {};

        // doing these operations here instead of inside the loop
        if (this.settings_.inject.relevance && this.settings_.inject.missingTerms) {
          matches.forEach(function(match) {
            items[ match[0] ] = this.functions_.getItemInjectAll_.call(this, match);
          });

        } else if (this.settings_.inject.relevance) {
          matches.forEach(function(match) {
            items[ match[0] ] = this.functions_.getItemInjectRelevance_.call(this, match);
          })

        } else if (this.settings_.inject.missingTerms) {
          matches.forEach(function(match) {
            items[ match[0] ] = this.functions_.getItemInjectMissingTerms_.call(this, match);
          })

        } else {
          matches.forEach(function(match) {
            items[ match[0] ] = this.functions_.getItem_.call(this, match);
          })
        }

        return items;
      }
    },

    //// Process and update search terms
    updateConstraints_() {
      if (!this.state_.ready) {
        if (this.state_.searchText === '') {
          this.state_.searchTerms = [];

        } else {
          this.state_.searchTerms = (
            this.settings_.comparison.case ?
                this.state_.searchText :
                this.state_.searchText.toLowerCase()
          ).split(' ');
        }

        this.state_.ready = true;
      }
    },

    //// Check if there are any constraints
    isConstrained() {
      // update constraints if needed
      this.functions_.updateConstraints_.call(this);
      return this.state_.searchTerms.length || this.state_.filters.length
    },

    /// END HELPER FUNCTIONS
  },

  // END INTERNAL FUNCTIONS




  // ACCESSORS

  /// Count of total matches
  get length() {
    this.functions_.updateMatches_.call(this);
    return this.state_.totalMatches;
  },

  /// Gets all items that match all the constraints
  /// and returns them as the same type of Object they were originally
  get matches() {
    this.functions_.updateMatches_.call(this);
    // already sorted if needed
    return this.functions_.toOriginalFormat_.call(this, this.state_.matches);
  },

  /// Gets all items that only match some of the constraints
  /// and returns them as the same type of Object they were originally
  get partialMatches() {
    this.functions_.updateMatches_.call(this);
    this.functions_.performSort_.call(this, this.state_.partial);

    return this.functions_.toOriginalFormat_.call(this, this.state_.partial);
  },

  /// Gets all items that match any of the constraints
  /// and returns them as the same type of Object they were originally
  get allMatches() {
    this.functions_.updateMatches_.call(this);
    let allMatches = this.state_.matches.concat(this.state_.partial);
    this.functions_.performSort_.call(this, allMatches);

    return this.functions_.toOriginalFormat_.call(this, allMatches);
  },

  /// Gets all items in the collection
  /// and returns them as the same type of Object they were originally
  get allItems() {
    this.functions_.updateMatches_.call(this);
    this.functions_.performSort_.call(this, this.state_.allItems);

    return this.functions_.toOriginalFormat_.call(
      this,
      this.state_.allItems
    );
  }

  // END ACCESSORS
}

SearchLight.search = SearchLight.search_.bind(SearchLight);

export default SearchLight.search;

if (typeof window !== 'undefined') {
  window.SearchLight = SearchLight;
} else if (typeof define == "function" && define.amd) {
  define([], function(){ return SearchLight.search });
}
