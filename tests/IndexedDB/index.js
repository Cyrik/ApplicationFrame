/* eslint-env mocha */

const { expect } = require('chai');
const mochaVM = require('../../node/mochaVM');
const IndexedDBShim = require('../shims/IndexedDbShim');

describe('IndexedDB', () => {
    const vm = mochaVM();

    mochaVM.applyNodeEnv(vm);

    vm.updateContext({
        indexedDB: IndexedDBShim(),
        IDBKeyRange: IndexedDBShim.IDBKeyRange,
        process, // nyc needs this to run bable for instrumentation
    });

    vm.runModule('../../testable/IndexedDB/index.js');

    it('should not be accessible after closing the connection', () => {
        const { testResult } = vm.apply((IndexedDB, async) => {
            const db = Object.create(IndexedDB).constructor('test-db');

            db.define(1).store('Test');

            const openPromise = new Promise((resolve, reject) => {
                async(() => {
                    db.write('Test', { a: 1 }).then(resolve, reject);
                });
            });

            const closedPromise = new Promise((resolve, reject) => {
                async(() => {
                    db.close();
                    db.write('Test', { t: 4 }).then(resolve, reject);
                });
            });

            global.testResult = { openPromise, closedPromise };
        }, ['IndexedDB', '_async.default']);

        expect(testResult.openPromise).to.be.a('promise');
        expect(testResult.closedPromise).to.be.a('promise');

        return Promise.all([
            testResult.openPromise
                .then(() => expect(true).to.be.true)
                .catch(() => expect.fail('promise should not reject!')),
            testResult.closedPromise
                .then(() => expect.fail('promise should reject!'))
                .catch(() => expect(true).to.be.true)
        ]);
    });

    it('should upgrade the db at runtime when requested', () => {
        const { testResult, indexedDB } = vm.apply((IndexedDB, async) => {
            const db = Object.create(IndexedDB).constructor('test-db-2');

            db.define(1).store('Test');

            const openPromise = new Promise((resolve, reject) => {
                async(() => {
                    db.write('Test', { a: 1 }).then(resolve, reject);
                });
            });

            const updatePromise = openPromise.then(() => {
                return db.upgrade(2)
                    .store('SecondStore')
                    .index('id');
            });

            const postUpdatePromise = updatePromise.then(() => {
                return new Promise((resolve, reject) => {
                    async(() => {
                        db.write('SecondStore', { id: 1234 })
                            .then(resolve, reject);
                    });
                });
            });

            global.testResult = { postUpdatePromise };
        }, ['IndexedDB', '_async.default']);

        expect(testResult.postUpdatePromise).to.be.a('promise');

        return testResult.postUpdatePromise
            .then(() => {
                expect(indexedDB.dbs['test-db-2']['SecondStore']).to.be.an('object');
                expect(indexedDB.dbs['test-db-2']['SecondStore']).to.have.property('indexes');
                expect(indexedDB.dbs['test-db-2']['SecondStore']).to.have.property('items');
            }, () => expect.fail('promise should not reject!'));
    });

    describe('delete', () => {
        it('should delete the object matching a key', () => {
            const { testResult, indexedDB } = vm.apply((IndexedDB) => {
                const db = Object.create(IndexedDB).constructor('delete-test-db-1');

                db.define(1)
                    .store({ name: 'test-1', keyPath: 'id' });

                global.testResult = Promise.all([
                    db.write('test-1', { id: 123, test: 'a' }),
                    db.write('test-1', { id: 124, a: 1, b: 2 }),
                    db.write('test-1', { id: 133, x: 0, y: 9 }),
                ]);
            }, ['IndexedDB']);

            return testResult.then(() => {
                expect(indexedDB.dbs['delete-test-db-1']['test-1'].items).to.have.lengthOf(3);
            }).then(() => {
                const { testResult } = vm.apply((IndexedDB) => {
                    const db = Object.create(IndexedDB).constructor('delete-test-db-1');

                    db.define(1);

                    global.testResult = db.delete('test-1').equals(124).commit();
                }, ['IndexedDB']);

                return testResult;
            }).then(() => {
                expect(indexedDB.dbs['delete-test-db-1']['test-1'].items).to.have.lengthOf(2);
                expect(indexedDB.dbs['delete-test-db-1']['test-1'].items).to.be.deep.equal([
                    { id: 123, test: 'a' },
                    { id: 133, x: 0, y: 9 },
                ]);
            });
        });

        it('should delete all objects matching a key range', () => {
            const { testResult, indexedDB } = vm.apply((IndexedDB) => {
                const db = Object.create(IndexedDB).constructor('delete-test-db-2');

                db.define(1)
                    .store({ name: 'test-1', keyPath: 'id' });

                global.testResult = Promise.all([
                    db.write('test-1', { id: 123, test: 'a' }),
                    db.write('test-1', { id: 124, a: 1, b: 2 }),
                    db.write('test-1', { id: 133, x: 0, y: 9 }),
                ]);
            }, ['IndexedDB']);

            return testResult.then(() => {
                expect(indexedDB.dbs['delete-test-db-2']['test-1'].items).to.have.lengthOf(3);
            }).then(() => {
                const { testResult } = vm.apply((IndexedDB) => {
                    const db = Object.create(IndexedDB).constructor('delete-test-db-2');

                    db.define(1);

                    global.testResult = db.delete('test-1').from(100).to(124).commit();
                }, ['IndexedDB']);

                return testResult;
            }).then(() => {
                expect(indexedDB.dbs['delete-test-db-2']['test-1'].items).to.have.lengthOf(1);
                expect(indexedDB.dbs['delete-test-db-2']['test-1'].items).to.be.deep.equal([
                    { id: 133, x: 0, y: 9 },
                ]);
            });
        });

        it('should delete all objects matching an actual IDBKeyRange', () => {
            const { testResult, indexedDB } = vm.apply((IndexedDB) => {
                const db = Object.create(IndexedDB).constructor('delete-test-db-3');

                db.define(1)
                    .store({ name: 'test-1', keyPath: 'id' });

                global.testResult = Promise.all([
                    db.write('test-1', { id: 123, test: 'a' }),
                    db.write('test-1', { id: 124, a: 1, b: 2 }),
                    db.write('test-1', { id: 133, x: 0, y: 9 }),
                ]);
            }, ['IndexedDB']);

            return testResult.then(() => {
                expect(indexedDB.dbs['delete-test-db-3']['test-1'].items).to.have.lengthOf(3);
            }).then(() => {
                const { testResult } = vm.apply((IndexedDB) => {
                    const db = Object.create(IndexedDB).constructor('delete-test-db-3');

                    db.define(1);

                    global.testResult = db.delete('test-1').higherThan(123).lowerThan(134).commit();
                }, ['IndexedDB']);

                return testResult;
            }).then(() => {
                expect(indexedDB.dbs['delete-test-db-3']['test-1'].items).to.have.lengthOf(1);
                expect(indexedDB.dbs['delete-test-db-3']['test-1'].items).to.be.deep.equal([
                    { id: 123, test: 'a' },
                ]);
            });
        });

        it('should throw if no range is specified', () => {
            vm.updateContext({ testResult: null });

            const { testResult } = vm.apply((IndexedDB) => {
                const db = Object.create(IndexedDB).constructor('delete-test-db-3');

                db.define(1);

                try {
                    db.delete('test-1').commit();
                } catch (e) {
                    global.testResult = e;
                }
            }, ['IndexedDB']);

            expect(testResult).to.be.an('error', '.commit() should throw');
        });
    });

    describe('clear', () => {
        it('should delete all objects from store', () => {
            const { testResult, indexedDB } = vm.apply((IndexedDB) => {
                const db = Object.create(IndexedDB).constructor('clear-test-db-1');

                db.define(1)
                    .store({ name: 'test-1', keyPath: 'id' });

                global.testResult = Promise.all([
                    db.write('test-1', { id: 123, test: 'a' }),
                    db.write('test-1', { id: 124, a: 1, b: 2 }),
                    db.write('test-1', { id: 133, x: 0, y: 9 }),
                ]);
            }, ['IndexedDB']);

            return testResult.then(() => {
                expect(indexedDB.dbs['clear-test-db-1']['test-1'].items).to.have.lengthOf(3);
            }).then(() => {
                const { testResult } = vm.apply((IndexedDB) => {
                    const db = Object.create(IndexedDB).constructor('clear-test-db-1');

                    db.define(1);

                    global.testResult = db.clear('test-1');
                }, ['IndexedDB']);

                return testResult;
            }).then(() => {
                expect(indexedDB.dbs['clear-test-db-1']['test-1'].items).to.have.lengthOf(0);
            });
        });
    });
});
