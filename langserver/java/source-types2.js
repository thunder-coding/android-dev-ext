const { CEIType, JavaType, PrimitiveType, Field, Method, MethodBase, Constructor, Parameter } = require('java-mti');
const { Token } = require('./tokenizer');

/**
 * @param {SourceType|SourceMethod|SourceConstructor|SourceInitialiser|string} scope_or_package_name 
 * @param {Token} name 
 */
function generateShortSignature(scope_or_package_name, name) {
    if (scope_or_package_name instanceof SourceType) {
        const type = scope_or_package_name;
        return `${type._rawShortSignature}$${name.value}`;
    }
    if (scope_or_package_name instanceof SourceMethod
        || scope_or_package_name instanceof SourceConstructor
        || scope_or_package_name instanceof SourceInitialiser) {
        const method = scope_or_package_name;
        return `${method.owner._rawShortSignature}$${method.owner.localTypeCount += 1}${name.value}`;
    }
    const pkgname = scope_or_package_name;
    return pkgname ?`${pkgname.replace(/\./g, '/')}/${name.value}` : name.value;
}

class SourceType extends CEIType {
    /**
     * @param {string} packageName
     * @param {SourceType|SourceMethod|SourceConstructor|SourceInitialiser} outer_scope
     * @param {string} docs 
     * @param {string[]} modifiers 
     * @param {Token} kind_token 
     * @param {Token} name_token 
     */
    constructor(packageName, outer_scope, docs, modifiers, kind_token, name_token, typemap) {
        // @ts-ignore
        super(generateShortSignature(outer_scope || packageName, name_token), kind_token.source, modifiers, docs);
        super.packageName = packageName;
        this.kind_token = kind_token;
        this.name_token = name_token;
        this.scope = outer_scope;
        this.typemap = typemap;
        /**
         * Number of local/anonymous types declared in the scope of this type
         * The number is used when naming them.
         */
        this.localTypeCount = 0;
        /** @type {SourceTypeIdent[]} */
        this.extends_types = [];
        /** @type {SourceTypeIdent[]} */
        this.implements_types = [];
        /** @type {SourceConstructor[]} */
        this.constructors = [];
        /** @type {SourceMethod[]} */
        this.methods = [];
        /** @type {SourceField[]} */
        this.fields = [];
        /** @type {SourceInitialiser[]} */
        this.initers = [];
    }

    get supers() {
        const supertypes = [...this.extends_types, ...this.implements_types].map(x => x.type);
        if (this.typeKind === 'enum') {
            /** @type {CEIType} */
            const enumtype = this.typemap.get('java/lang/Enum');
            supertypes.unshift(enumtype.specialise([this]));
        }
        else if (!supertypes.find(type => type.typeKind === 'class')) {
            supertypes.unshift(this.typemap.get('java/lang/Object'));
        }
        return supertypes;
    }
}

class SourceTypeIdent {
    /**
     * @param {Token[]} tokens 
     * @param {JavaType} type 
     */
    constructor(tokens, type) {
        this.typeTokens = tokens;
        this.type = type;
    }
}

class SourceField extends Field {
    /**
     * @param {SourceType} owner 
     * @param {Token[]} modifiers 
     * @param {SourceTypeIdent} field_type 
     * @param {Token} name_token 
     */
    constructor(owner, modifiers, field_type, name_token) {
        super(modifiers.map(m => m.value), '');
        this.owner = owner;
        this.fieldType = field_type;
        this.nameToken = name_token;
    }

    get name() {
        return this.nameToken ? this.nameToken.value : '';
    }

    get type() {
        return this.fieldType.type;
    }
}

class SourceConstructor extends Constructor {
    /**
     * @param {SourceType} owner 
     * @param {Token[]} modifiers 
     * @param {SourceParameter[]} parameters 
     * @param {JavaType[]} throws 
     * @param {Token[]} body 
     */
    constructor(owner, modifiers, parameters, throws, body) {
        super(owner, modifiers.map(m => m.value), '');
        this.owner = owner;
        this.sourceParameters = parameters;
        this.throws = throws;
        this.body = body;
    }

    get hasImplementation() {
        return !!this.body;
    }

    get parameterCount() {
        return this.sourceParameters.length;
    }

    /**
     * @returns {SourceParameter[]}
     */
    get parameters() {
        return this.sourceParameters;
    }

    /**
     * @returns {SourceType}
     */
    get returnType() {
        return this.owner;
    }
}

class SourceMethod extends Method {
    /**
     * @param {SourceType} owner 
     * @param {Token[]} modifiers 
     * @param {SourceAnnotation[]} annotations
     * @param {SourceTypeIdent} method_type_ident 
     * @param {Token} name_token 
     * @param {SourceParameter[]} parameters 
     * @param {JavaType[]} throws 
     * @param {Token[]} body 
     */
    constructor(owner, modifiers, annotations, method_type_ident, name_token, parameters, throws, body) {
        super(owner, name_token ? name_token.value : '', modifiers.map(m => m.value), '');
        this.annotations = annotations;
        this.owner = owner;
        this.methodTypeIdent = method_type_ident;
        this.sourceParameters = parameters;
        this.throws = throws;
        this.body = body;
    }

    get hasImplementation() {
        return !!this.body;
    }

    get parameterCount() {
        return this.sourceParameters.length;
    }

    /**
     * @returns {SourceParameter[]}
     */
    get parameters() {
        return this.sourceParameters;
    }

    /**
     * @returns {JavaType}
     */
    get returnType() {
        return this.methodTypeIdent.type;
    }
}

class SourceInitialiser extends MethodBase {
    /**
     * @param {SourceType} owner
     * @param {Token[]} modifiers 
     * @param {Token[]} body 
     */
    constructor(owner, modifiers, body) {
        super(owner, modifiers.map(m => m.value), '');
        /** @type {SourceType} */
        this.owner = owner;
        this.body = body;
    }

    /**
     * @returns {SourceParameter[]}
     */
    get parameters() {
        return [];
    }

    get returnType() {
        return PrimitiveType.map.V;
    }
}

class SourceParameter extends Parameter {
    /**
     * @param {Token[]} modifiers 
     * @param {SourceTypeIdent} typeident 
     * @param {boolean} varargs 
     * @param {Token} name_token 
     */
    constructor(modifiers, typeident, varargs, name_token) {
        super(name_token ? name_token.value : '', typeident.type, varargs);
        this.name_token = name_token;
        this.modifiers = modifiers;
        this.paramTypeIdent = typeident;
    }
}

class SourceAnnotation {
    /**
     * @param {SourceTypeIdent} typeident 
     */
    constructor(typeident) {
        this.annotationTypeIdent = typeident;
    }
}

exports.SourceType = SourceType;
exports.SourceTypeIdent = SourceTypeIdent;
exports.SourceField = SourceField;
exports.SourceMethod = SourceMethod;
exports.SourceParameter = SourceParameter;
exports.SourceConstructor = SourceConstructor;
exports.SourceInitialiser = SourceInitialiser;
exports.SourceAnnotation = SourceAnnotation;
