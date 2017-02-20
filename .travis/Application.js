/* eslint-env mocha */

const Import = require('./tools/import');
const expect = require('chai').expect;


describe('Application', () => {
    const applicationModule = Import('../../testable/core/Application');
    let instance = null;

    it('should construct a new application', () => {
        const { Make } = require('../testable/util/make');
        const { default: Application } = applicationModule.value;

        instance = Make(Application)();

        expect(Object.getPrototypeOf(instance)).to.equal(Application);
    });

    it('should broadcast an event on the application', (done) => {
        instance.on('test#1', () => done());
        instance.emit('test#1', true);
    });
});
