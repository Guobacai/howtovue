When you start using Vue, the first line you wrote in your code is probably:
```javascript
import Vue from 'vue';
```
This chapter focus on explaining what will happen when running the above code.
In the package.json, the module property is defined as 
```json
{
  "module": "dist/vue.runtime.esm.js"
}
```
Where does this file come from?  
As official document says, you could run `npm run build` to build the Vue. Let's go to the package.json and see what does this command actually run?  
```json
{
  "build": "node scripts/build.js"
}
```
Simple. It runs the script "build.js". We could ignore all the stuff in this script except the following statement:
```javascript
let builds = require('./config').getAllBuilds();
```
It shouldn't be hard to guess what this code does. It gets all builds from the file "config.js".  
If you open the file "config.js", the first thing you might notice is the constant variable "builds" which includes all different builds.  
You could read the [official document](https://vuejs.org/v2/guide/installation.html#Explanation-of-Different-Builds) to understand what are the differences between each build.  
In the build "web-runtime-esm", the destination(dest) is "dist/vue.runtime.esm.js" and its "entry" is "web/entry-runtime.js"  
```javascript
const builds = {
...
// Runtime only ES modules build (for bundlers)
'web-runtime-esm': {
  entry: resolve('web/entry-runtime.js'),
  dest: resolve('dist/vue.runtime.esm.js'),
  format: 'es',
  banner
},
...
}
```
It is not hard to guess the "entry" is the entry point for rollup, but you may find it is not easy to find "web/entry-runtime.js", where is it?
Let's look at the function `resolve`
```javascript
const resolve = p => {
  const base = p.split('/')[0]
  if (aliases[base]) {
    return path.resolve(aliases[base], p.slice(base.length + 1))
  } else {
    return path.resolve(__dirname, '../', p)
  }
}
```
In case of "web/entry-runtime.js", the variable "base" is "web". The "aliases" comes from './alias'
```javascript
module.exports = {
  vue: resolve('src/platforms/web/entry-runtime-with-compiler'),
  compiler: resolve('src/compiler'),
  core: resolve('src/core'),
  shared: resolve('src/shared'),
  web: resolve('src/platforms/web'),
  weex: resolve('src/platforms/weex'),
  server: resolve('src/server'),
  sfc: resolve('src/sfc')
}
```
You can see the 'web' resolves based on "src/platforms/web". So, the "web/entry-runtime.js" is resolved as "src/platforms/web/entry-runtime.js".  
Let's open this file. It only has two lines.
```javascript
import Vue from './runtime/index'

export default Vue
```
In this file, the Vue is imported from `src/platforms/web/runtime/index.js`.
After open it, we can see Vue is imported from `src/core/index.js`. Unfortunately, this is still not the place where the 
constructor of Vue is defined.
```javascript
import Vue from './instance/index'
```
Let's continue to open the file 'src/core/instance/index.js'.
```js
import { initMixin } from './init'
import { stateMixin } from './state'
import { renderMixin } from './render'
import { eventsMixin } from './events'
import { lifecycleMixin } from './lifecycle'
import { warn } from '../util/index'

function Vue (options) {
  if (process.env.NODE_ENV !== 'production' &&
    !(this instanceof Vue)
  ) {
    warn('Vue is a constructor and should be called with the `new` keyword')
  }
  this._init(options)
}

initMixin(Vue)
stateMixin(Vue)
eventsMixin(Vue)
lifecycleMixin(Vue)
renderMixin(Vue)

export default Vue
```
This file contains much more stuff. But, the first we might notice is the constructor of the Vue.
```js
function Vue (options) {
  if (process.env.NODE_ENV !== 'production' &&
    !(this instanceof Vue)
  ) {
    warn('Vue is a constructor and should be called with the `new` keyword')
  }
  this._init(options)
}
```
If we ignore the first `if` statement, the constructor is simply calling the function `_init`.
The `if` statement checks if you are not in DEV environment and the instance is not create by `new Vue()`, it prints
a warning message.
After defining the constructor, there are some functions used for decorating the Vue constructor.
```javascript
...
initMixin(Vue)
stateMixin(Vue)
eventsMixin(Vue)
lifecycleMixin(Vue)
renderMixin(Vue)
...
```
# initMixin
The `initMixin` is defined in the `src/core/instance/init`. It defines the `_init` function on the `Vue.prototype`. The 
`_init` will be explained later.
# stateMixin
The `stateMixin` is defined in the `src/core/instance/state`. It does a few things and let's take closer look to this function.
```javascript
  const dataDef = {}
  dataDef.get = function () { return this._data }
  const propsDef = {}
  propsDef.get = function () { return this._props }
  if (process.env.NODE_ENV !== 'production') {
    dataDef.set = function () {
      warn(
        'Avoid replacing instance root $data. ' +
        'Use nested data properties instead.',
        this
      )
    }
    propsDef.set = function () {
      warn(`$props is readonly.`, this)
    }
  }
  Object.defineProperty(Vue.prototype, '$data', dataDef)
  Object.defineProperty(Vue.prototype, '$props', propsDef)
...
```
The constants `dataDef` and `propsDef` are defined as two plain objects.
Then, both constants are set with customized [getter](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/get).
```javascript
dataDef.get = function () { return this._data }
propsDef.get = function () { return this._props }
```
So, when looking up the `dataDef`, it actually reads the `_data`. Same to the `propsDef`, it reads the `_props`.
Eventually, the `dataDef` and `propsDef` are defined on `Vue.prototype` as instance properties - [$data](https://vuejs.org/v2/api/#vm-data) and [$props](https://vuejs.org/v2/api/#vm-props).
```javascript
Object.defineProperty(Vue.prototype, '$data', dataDef)
Object.defineProperty(Vue.prototype, '$props', propsDef)
```
If you write this code in your project, under the hood, it actually reads the data from `this._data.test`.
```javascript
this.$data.test
```
The `if` statement in the middle sets the [setter](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/set)
for both `dataDef` and `propsDef` under the development environment. Both setters prevent developer from resetting the
`$data` and `$props`. Thus, when you do the following, you will see the warning message.
```javascript
this.$data = {};
this.$props = {};
```
The rest part of of the function `stateMixin` defines `$set`, `$delete` and `$watch` on the `Vue.prototype`. We will 
address these functions when we explain how "reactivity" works.  
Function `eventsMixin` defines `$on`, `$once`, `$off` and `$emit` on the `Vue.prototype`.  
Function `lifecycleMixin` defines `_update`, `$forceUpdate` and `$destroy` on the `Vue.prototype`.  
Function `renderMixin` defines `_render`, `$nextTick` on the `Vue.prototype`.  
After these functions, the `Vue.prototype` becomes:
```javascript
Vue.prototype = {
  $data: {},
  $props: {},
  _init: function() {...},
  $set: function() {...},
  $delete: function() {...},
  $watch: function() {...},
  $on: function() {...},
  $once: function() {...},
  $off: function() {...},
  $emit: function() {...},
  $forceUpdate: function() {...},
  $destroy: function() {...},
  $nextTick: function() {...},
  _update: function() {...},
  _render: function() {...},
};
```
The file `src/code/instance/index` finishes execution. Let's go back to file `src/code/index`.
The first code it runs is:
```javascript
...
initGlobalAPI(Vue)
...
```
From the name of the function, it is not hard to guess this function initialize [global apis](https://vuejs.org/v2/api/#Global-API) on the `Vue`.
The `initGlobalAPI` is defined in the `src/core/global-api/index.js`. Let's see what it does.  
Firstly, it defines the static property `config` on the `Vue`.
```javascript
...
  const configDef = {}
  configDef.get = () => config
  if (process.env.NODE_ENV !== 'production') {
    configDef.set = () => {
      warn(
        'Do not replace the Vue.config object, set individual fields instead.'
      )
    }
  }
  Object.defineProperty(Vue, 'config', configDef)
...
```
It is similar to how `$props` and `$data` are defined except the `config` is defined as a static property.
This is why the developer can use it as `Vue.config`. The getter of `configDef` returns `config` which is defined in file `src/core/config.js`.
If you open that file, it is simply an object contains all the properties in the [official document](https://vuejs.org/v2/api/#Global-Config). 
All these properties will be covered later. So far, we only need to know where these configurations come from.
Next, it defines a few static functions on `Vue`. You might be familiar with some of them like `Vue.set`.
```javascript
...
  // exposed util methods.
  // NOTE: these are not considered part of the public API - avoid relying on
  // them unless you are aware of the risk.
  Vue.util = {
    warn,
    extend,
    mergeOptions,
    defineReactive
  }

  Vue.set = set
  Vue.delete = del
  Vue.nextTick = nextTick

  // 2.6 explicit observable API
  Vue.observable = <T>(obj: T): T => {
    observe(obj)
    return obj
  }
...
```
Next, it defines `Vue.options`.
```javascript
...
  Vue.options = Object.create(null)
  ASSET_TYPES.forEach(type => {
    Vue.options[type + 's'] = Object.create(null)
  })
...
```
`Object.create(null)` creates a [null object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/create#Custom_and_Null_objects)
which is basically a custom object without any member.  
Next, it defines a few "Assets" on Vue. The `ASSET_TYPES` is defined in the file `src/shared/constant.js`.
```javascript
export const ASSET_TYPES = [
  'component',
  'directive',
  'filter'
]
```
After the loop, the Vue becomes:
```javascript
Vue = {
  util: {
    warn,
    extend,
    mergeOptions,
    defineReactive
  },
  set: function() {...},
  delete: function() {...},
  nextTick: function() {...},
  observable: function() {...},
  options: {
    components: {},
    directives: {},
    filters: {},
  },
  prototype: {
    ...
  }
}
```
Next code is:
```javascript
Vue.options._base = Vue
```
It assigns the constructor of Vue to `Vue.options._base`. As the comment explains, this is used to identify
the "base" constructor to extend all the plain-object. You will see it will be used for standardizing the options.
```javascript
extend(Vue.options.components, builtInComponents)
```
You can check here to see what function `extend` does. It merges the `builtInComponents` into `Vue.options.components`.
The `builtInComponents` is defined in the `src/core/components/index.js`.
```javascript
import KeepAlive from './keep-alive'

export default {
  KeepAlive
}
```
After the function `extend`, the built-in component `Keep-Alive` is merged to `Vue.options.components`.
```javascript
Vue = {
  ...
  options: {
    components: {
      KeepAlive
    } 
  },
  ...
}
```
Next, four functions are called to decorate the `Vue`.
```javascript
...
initUse(Vue)
initMixin(Vue)
initExtend(Vue)
initAssetRegisters(Vue)
```
# Vue.use 
The `initUse` initializes the [Vue.use](https://vuejs.org/v2/api/#Vue-use).
If you have used the plugin of Vue like "Vuex", you should have known how to use it:
```javascript
Vue.use(Vuex);
```
The `initUse` is defined in the file `src/core/globa-api/use.js`.
```javascript
import { toArray } from '../util/index'

export function initUse (Vue: GlobalAPI) {
  Vue.use = function (plugin: Function | Object) {
    const installedPlugins = (this._installedPlugins || (this._installedPlugins = []))
    if (installedPlugins.indexOf(plugin) > -1) {
      return this
    }

    // additional parameters
    const args = toArray(arguments, 1)
    args.unshift(this)
    if (typeof plugin.install === 'function') {
      plugin.install.apply(plugin, args)
    } else if (typeof plugin === 'function') {
      plugin.apply(null, args)
    }
    installedPlugins.push(plugin)
    return this
  }
}
```
The entire file just defines `Vue.use` as a function. The first part of the function is
```javascript
...
    const installedPlugins = (this._installedPlugins || (this._installedPlugins = []))
    if (installedPlugins.indexOf(plugin) > -1) {
      return this
    }
...
```
It checks if the plugin has been installed. If yes, it returns immediately. So, none of any plugin will be installed
twice.
If not, then it proceeds:
```javascript
const args = toArray(arguments, 1)
args.unshift(this)
```
`toArray` removes the first argument and converts the rest into a real array.
In the next line, the first argument is set to the current Vue instance. This is the reason why 
[official document](https://vuejs.org/v2/guide/plugins.html#Writing-a-Plugin) emphasize that `install` function will be
called with Vue constructor as the first argument.
Let's see how `install` is called.
```javascript
if (typeof plugin.install === 'function') {
  plugin.install.apply(plugin, args)
} else if (typeof plugin === 'function') {
  plugin.apply(null, args)
}
```
If the plugin has the function `install`, then call it with the `args`.
Or, a plugin can be a pure function. This way is not documented in the official document.
Finally, it saves this new plugin to `installedPlugins` to avoid the same plugin being installed twice.
# Vue.mixin
After that, it initializes the mixin by calling `initMixin`.
The `initMixin` is defined in the `src/core/global-api/mixin.js`
```javascript
import { mergeOptions } from '../util/index'

export function initMixin (Vue: GlobalAPI) {
  Vue.mixin = function (mixin: Object) {
    this.options = mergeOptions(this.options, mixin)
    return this
  }
}
```
Simple, right? It just merges the mixin to `this.options` and assign the result to `this.options`.
We will talk about the `mergeOptions` in the section "Merging the options".
Next, it initializes the `Vue.extend` by calling `initExtend`
# Assets Registers
`initAssetRegisters` is defined in file `src/core/global-api/assets.js`.
```javascript

export function initAssetRegisters (Vue: GlobalAPI) {
  /**
   * Create asset registration methods.
   */
  ASSET_TYPES.forEach(type => {
    Vue[type] = function (
      id: string,
      definition: Function | Object
    ): Function | Object | void {
      if (!definition) {
        return this.options[type + 's'][id]
      } else {
        /* istanbul ignore if */
        if (process.env.NODE_ENV !== 'production' && type === 'component') {
          validateComponentName(id)
        }
        if (type === 'component' && isPlainObject(definition)) {
          definition.name = definition.name || id
          definition = this.options._base.extend(definition)
        }
        if (type === 'directive' && typeof definition === 'function') {
          definition = { bind: definition, update: definition }
        }
        this.options[type + 's'][id] = definition
        return definition
      }
    }
  })
}
```
It loops through `ASSET_TYPES` to define "component", "filter" and "directive" on Vue.  
After loop, Vue will have three more global apis
```javascript
Vue.component = function() {};
Vue.directive = function() {};
Vue.filter = function() {};
```
# Vue.component
The [official document](https://vuejs.org/v2/api/#Vue-component) gives a few examples. Let's take a look at these examples.
```javascript
// retrieve a registered component (always return constructor)
Vue.component('my-component');
```
In this example, the `Vue.component` is called only with `id`.
```javascript
if (!definition) {
  return this.options[type + 's'][id]
}
```
If the `defintion` doesn't exist, it returns `this.options.components['my-component']`. In the later chapters, you will
see all the components registered in the `this.options.components` are going to be initialized as constructor. This is why
, in the comment, it says "always return constructor".
```javascript
// register an extended constructor
Vue.component('my-component', Vue.extend({ /* ... */ }))
// register an options object (automatically call Vue.extend)
Vue.component('my-component', { /* ... */ })
```
These two examples pass the `definition` to `Vue.component`. The difference is one is a plain object, the other one is 
the return value of `Vue.extend({...})`. Let's see what are the actual difference in the code.
If `Vue.component` is passed with `definition`, then it goes to `else`. Let's skip the first if statement and look at the
second one.
```javascript
if (type === 'component' && isPlainObject(definition)) {
  definition.name = definition.name || id
  definition = this.options._base.extend(definition)
}
```
If the `definition` is a plain object which is the second example, then it uses `id` as the default component name and 
calls `this.options._base.extend` with `definition`. As explained before, the `this.options._base` is the Vue constructor.
So, this is same as calling `Vue.extend`. That is what comments explains "automatically call Vue.extend".  
Let's go back to the first if statement.
```javascript
if (process.env.NODE_ENV !== 'production' && type === 'component') {
  validateComponentName(id)
}
```
When it calls `Vue.component` under the development environment, it validates the component name - id.
The `validateComponentName` is defined in file `src/core/util/options.js`.
```javascript
export function validateComponentName (name: string) {
  if (!new RegExp(`^[a-zA-Z][\\-\\.0-9_${unicodeRegExp.source}]*$`).test(name)) {
    warn(
      'Invalid component name: "' + name + '". Component names ' +
      'should conform to valid custom element name in html5 specification.'
    )
  }
  if (isBuiltInTag(name) || config.isReservedTag(name)) {
    warn(
      'Do not use built-in or reserved HTML elements as component ' +
      'id: ' + name
    )
  }
}
```
In the first `if`, it uses a regular expression to test the component name.
```regexp
^[a-zA-Z][\\-\\.0-9_${unicodeRegExp.source}]*$
```
This regular expression is the translation of the [W3C rules](https://html.spec.whatwg.org/multipage/custom-elements.html#valid-custom-element-name).
The component name must start with an alphabet. It could contains "-", "_", "." and numbers. 
`unicodeRegExp` is defined in the file `src/code/util/lang.js`. 
[The source of a regular expression](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/source) is the string representation of regular expression.
If the component name doesn't comply with W3C rules, then it prints a warning in the console.
The second `if` checks whether the newly registered component is a "built-in" tag or a "reserved" tag.  
Let's take a look at the function `isBuiltInTag` which is defined in the file `src/shared/util.js`.
```javascript
/**
 * Check if a tag is a built-in tag.
 */
export const isBuiltInTag = makeMap('slot,component', true)
```
`isBuiltInTag` is the return value of function `makeMap`. The `makeMap` returns a function that returns true if the
name is either "slot" or "component".  
Let's look at the `config.isReservedTag(name)`. If you open the file `src/core/config.js`, you can find:
```javascript
export default ({
  ...
  /**
   * Check if a tag is reserved so that it cannot be registered as a
   * component. This is platform-dependent and may be overwritten.
   */
  isReservedTag: no,
  ...
});
```
The configuration is not exposed as "Global Config". As the comment points out, it is decided by different platform - 
"Web" or "Weex". Since we only focus on the "web", so let's look at how does the `isResveredTag` defined.  
In the file `src/platforms/web/runtime/index.js`, you can find:
```javascript
import { isReservedTag } from 'web/util/index';
...
Vue.config.isReservedTag = isReservedTag
...
```
After opening the `web/util/index`, you can see it export from the following three files:
* `src/platforms/web/util/class.js`
* `src/platforms/web/util/attrs.js`
* `src/platforms/web/util/element.js`
The `isReservedTag` is actually defined in the file `src/platforms/web/util/element.js`.
```javascript
export const isReservedTag = (tag: string): ?boolean => {
  return isHTMLTag(tag) || isSVG(tag)
}
```
It is pretty obvious. If the tag is an HTML tag or SVG tag, it will be treated as "Reserved". The `isHTMLTag` and `isSVG`
are defined above this function.
```javascript
export const isHTMLTag = makeMap(
  'html,body,base,head,link,meta,style,title,' +
  'address,article,aside,footer,header,h1,h2,h3,h4,h5,h6,hgroup,nav,section,' +
  'div,dd,dl,dt,figcaption,figure,picture,hr,img,li,main,ol,p,pre,ul,' +
  'a,b,abbr,bdi,bdo,br,cite,code,data,dfn,em,i,kbd,mark,q,rp,rt,rtc,ruby,' +
  's,samp,small,span,strong,sub,sup,time,u,var,wbr,area,audio,map,track,video,' +
  'embed,object,param,source,canvas,script,noscript,del,ins,' +
  'caption,col,colgroup,table,thead,tbody,td,th,tr,' +
  'button,datalist,fieldset,form,input,label,legend,meter,optgroup,option,' +
  'output,progress,select,textarea,' +
  'details,dialog,menu,menuitem,summary,' +
  'content,element,shadow,template,blockquote,iframe,tfoot'
)

// this map is intentionally selective, only covering SVG elements that may
// contain child elements.
export const isSVG = makeMap(
  'svg,animate,circle,clippath,cursor,defs,desc,ellipse,filter,font-face,' +
  'foreignObject,g,glyph,image,line,marker,mask,missing-glyph,path,pattern,' +
  'polygon,polyline,rect,switch,symbol,text,textpath,tspan,use,view',
  true
)
```
So, on the "web" platform, all these tag names are reserved. We have explained the function `validateComponentName`.
For `Vue.directive`, if the definition is a function, it will be called as `bind` and `update`. Please refer to the [doc](https://vuejs.org/v2/api/?#Vue-directive).
```javascript
if (type === 'directive' && typeof definition === 'function') {
  definition = { bind: definition, update: definition }
}
```
So far, we finish introducing the function `initGlobalAPI`.
In `src/code/index.js`, after `initGlobalAPI`, it defines the following two property on `Vue.prototype`.
* $isServer
* $ssrContext
Let's go back to file `src/platforms/web/runtime/index.js`. Except the first line which imports the Vue, the first part of 
this file is defining a few platform specific utils on `Vue.config`.
```javascript
import {
  query,
  mustUseProp,
  isReservedTag,
  isReservedAttr,
  getTagNamespace,
  isUnknownElement
} from 'web/util/index'
...
// install platform specific utils
Vue.config.mustUseProp = mustUseProp
Vue.config.isReservedTag = isReservedTag
Vue.config.isReservedAttr = isReservedAttr
Vue.config.getTagNamespace = getTagNamespace
Vue.config.isUnknownElement = isUnknownElement
...
```
We have introduced the `isReservedTag` when we explained `validateComponentName`. Let's see the others.
# mustUseProp
This function is defined in the file `src/platforms/web/util/attrs.js`.
```javascript
// attributes that should be using props for binding
const acceptValue = makeMap('input,textarea,option,select,progress')
export const mustUseProp = (tag: string, type: ?string, attr: string): boolean => {
  return (
    (attr === 'value' && acceptValue(tag)) && type !== 'button' ||
    (attr === 'selected' && tag === 'option') ||
    (attr === 'checked' && tag === 'input') ||
    (attr === 'muted' && tag === 'video')
  )
}
```
Vue force you to use a prop to bind with an attribute in the following situations:
* The tag is any of `input`, `textarea`, `option`, `select` or `progress`. It has attribute `value` and its `type` 
is not a button.
* The tag is `option` and it has attribute `selected`.
* The tag is `input` and it has attribute `checked`.
* The tag is `video` and it has attribute `muted`.
# isReservedAttribute
This function is defined in the file `src/platforms/web/util/attrs.js`.
```javascript
// these are reserved for web because they are directly compiled away
// during template compilation
export const isReservedAttr = makeMap('style,class')
```
It is pretty simple. The attribute `style` and `class` are treated as reserved attribute.
# getTagNamespace
This function is defined in the file `src/platforms/web/util/element.js`.
```javascript
export function getTagNamespace (tag: string): ?string {
  if (isSVG(tag)) {
    return 'svg'
  }
  // basic support for MathML
  // note it doesn't support other MathML elements being component roots
  if (tag === 'math') {
    return 'math'
  }
}
```
For all the svg tags, it has the namespace 'svg'. If the tag is 'math', it has the namespace 'math'.
Here is some explanation about [MathML](https://www.w3.org/Math/whatIsMathML.html).
# isUnknownElement
This function is defined in the file `src/platforms/web/util/element.js`.
```javascript
const unknownElementCache = Object.create(null)
export function isUnknownElement (tag: string): boolean {
  /* istanbul ignore if */
  if (!inBrowser) {
    return true
  }
  if (isReservedTag(tag)) {
    return false
  }
  tag = tag.toLowerCase()
  /* istanbul ignore if */
  if (unknownElementCache[tag] != null) {
    return unknownElementCache[tag]
  }
  const el = document.createElement(tag)
  if (tag.indexOf('-') > -1) {
    // http://stackoverflow.com/a/28210364/1070244
    return (unknownElementCache[tag] = (
      el.constructor === window.HTMLUnknownElement ||
      el.constructor === window.HTMLElement
    ))
  } else {
    return (unknownElementCache[tag] = /HTMLUnknownElement/.test(el.toString()))
  }
}
```
The `isUnknowElement` return a boolean value to indicate whether the tag is an unknown element or not.
If the environment is not browser, all the tags are treated as "Unknown Element".
If the tag is a reserved tag, then it is not an "Unknown Element".
If the tag isn't none of the above situations and it is already defined in the `unknownElementCache`, and this tag is 
already cached, then returns its cached value.  
If this tag hasn't been cached, the rest code checks if the tag has been registered as a custom tag. It uses `HTMLUnkownElement` 
and  to determine. If a tag has been registered, then `el` should have the corresponding constructor.
Otherwise, if the name of the tag is `user-name`, its constructor could be either `HTMLElement` or `HTMLUnknownElement`.
If the name of the tag is `username` and it has not been registered, then its constructor must be `HTMLUnknownElement`.
You can check the [stackoverflow](http://stackoverflow.com/a/28210364/1070244) in the comment.  
After installing the platform utils, it installs a few internal directives and components to Vue.
```javascript
// install platform runtime directives & components
extend(Vue.options.directives, platformDirectives)
extend(Vue.options.components, platformComponents)
```
The `plafromDirectives` is defined in the file `src/platforms/web/runtime/directives/index.js`. It installs `v-model` and 
`v-show` to `Vue.options.directives`.  
The `plafromComponents` is defined in the file `src/platforms/web/runtime/components/index.js`. It installs `Transition` and 
`TransitionGroup` to `Vue.options.components`.  
Next, it installs the `patch` function to `Vue.prototype.__patch__` only when it is in the browser environment. This `patch` 
function is used to patch the dom. We will talk about it later.
After installing the `patch` function, it installs the publich method `$mount`.
```javascript
// public mount method
Vue.prototype.$mount = function (
  el?: string | Element,
  hydrating?: boolean
): Component {
  el = el && inBrowser ? query(el) : undefined
  return mountComponent(this, el, hydrating)
}
```
The rest code is setting up the `dev-tools`. We will skip it for now.
Until now, `import Vue from 'vue'` is done. It finishes building the constructor of the Vue.
