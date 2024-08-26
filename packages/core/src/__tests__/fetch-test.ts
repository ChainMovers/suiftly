import { fetch_suiftly } from '../fetch';

describe('dummy_test()', () => {
    describe('when call with no parameter', () => {
        it('returns `true`', () => {
            expect(fetch_suiftly()).toBe(true);
        });
    });
});
