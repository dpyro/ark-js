/* eslint-disable max-len */

const assert = require('assert')
const ecdsa = require('../../lib/ecdsa')
const sinon = require('sinon')
const sinonTest = require('sinon-test')(sinon)

const BigInteger = require('bigi')
const ECPair = require('../../lib/ecpair')
const HDNode = require('../../lib/hdnode')

const fixtures = require('./fixtures.json')
const curve = ecdsa.__curve

const NETWORKS = require('../../lib/networks')
const NETWORKS_LIST = [] // Object.values(NETWORKS)
for (const networkName in NETWORKS) {
  NETWORKS_LIST.push(NETWORKS[networkName])
}

let validAll = []
fixtures.valid.forEach(function (f) {
  function addNetwork (n) {
    n.network = f.network
    return n
  }

  validAll = validAll.concat(addNetwork(f.master), f.children.map(addNetwork))
})

describe('HDNode', function () {
  describe('Constructor', function () {
    let keyPair, chainCode

    beforeEach(function () {
      const d = BigInteger.ONE

      keyPair = new ECPair(d, null)
      chainCode = new Buffer(32)
      chainCode.fill(1)
    })

    it('stores the keyPair/chainCode directly', function () {
      const hd = new HDNode(keyPair, chainCode)

      assert.strictEqual(hd.keyPair, keyPair)
      assert.strictEqual(hd.chainCode, chainCode)
    })

    it('has a default depth/index of 0', function () {
      const hd = new HDNode(keyPair, chainCode)

      assert.strictEqual(hd.depth, 0)
      assert.strictEqual(hd.index, 0)
    })

    it('throws on uncompressed keyPair', function () {
      keyPair.compressed = false

      assert.throws(function () {
        new HDNode(keyPair, chainCode)
      }, /BIP32 only allows compressed keyPairs/)
    })

    it('throws when an invalid length chain code is given', function () {
      assert.throws(function () {
        new HDNode(keyPair, new Buffer(20))
      }, /Expected property "1" of type Buffer\(Length: 32\), got Buffer\(Length: 20\)/)
    })
  })

  describe('fromSeed*', function () {
    fixtures.valid.forEach(function (f) {
      it(`calculates privKey and chainCode for ${f.master.fingerprint}`, function () {
        const network = NETWORKS[f.network]
        const hd = HDNode.fromSeedHex(f.master.seed, network)

        assert.strictEqual(hd.keyPair.toWIF(), f.master.wif)
        assert.strictEqual(hd.chainCode.toString('hex'), f.master.chainCode)
      })
    })

    it('throws if IL is not within interval [1, n - 1] | IL === 0', sinonTest(function () {
      this.mock(BigInteger).expects('fromBuffer')
        .once().returns(BigInteger.ZERO)

      assert.throws(function () {
        HDNode.fromSeedHex('ffffffffffffffffffffffffffffffff')
      }, /Private key must be greater than 0/)
    }))

    it('throws if IL is not within interval [1, n - 1] | IL === n', sinonTest(function () {
      this.mock(BigInteger).expects('fromBuffer')
        .once().returns(curve.n)

      assert.throws(function () {
        HDNode.fromSeedHex('ffffffffffffffffffffffffffffffff')
      }, /Private key must be less than the curve order/)
    }))

    it('throws on low entropy seed', function () {
      assert.throws(function () {
        HDNode.fromSeedHex('ffffffffff')
      }, /Seed should be at least 128 bits/)
    })

    it('throws on too high entropy seed', function () {
      assert.throws(function () {
        HDNode.fromSeedHex('ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
      }, /Seed should be at most 512 bits/)
    })
  })

  describe('ECPair wrappers', function () {
    let keyPair, hd, hash

    beforeEach(function () {
      keyPair = ECPair.makeRandom()
      hash = new Buffer(32)

      const chainCode = new Buffer(32)
      hd = new HDNode(keyPair, chainCode)
    })

    describe('address', function () {
      it('wraps keyPair.getAddress', sinonTest(function () {
        this.mock(keyPair).expects('getAddress')
          .once().withArgs().returns('foobar')

        assert.strictEqual(hd.address, 'foobar')
      }))
    })

    describe('getNetwork', function () {
      it('wraps keyPair.getNetwork', sinonTest(function () {
        this.mock(keyPair).expects('getNetwork')
          .once().withArgs().returns('network')

        assert.strictEqual(hd.network, 'network')
      }))
    })

    describe('publicKeyBuffer', function () {
      it('wraps keyPair.getPublicKeyBuffer', sinonTest(function () {
        this.mock(keyPair).expects('getPublicKeyBuffer')
          .once().withArgs().returns('pubKeyBuffer')

        assert.strictEqual(hd.publicKeyBuffer, 'pubKeyBuffer')
      }))
    })

    describe('sign', function () {
      it('wraps keyPair.sign', sinonTest(function () {
        this.mock(keyPair).expects('sign')
          .once().withArgs(hash).returns('signed')

        assert.strictEqual(hd.sign(hash), 'signed')
      }))
    })

    describe('verify', function () {
      let signature

      beforeEach(function () {
        signature = hd.sign(hash)
      })

      it('wraps keyPair.verify', sinonTest(function () {
        this.mock(keyPair).expects('verify')
          .once().withArgs(hash, signature).returns('verified')

        assert.strictEqual(hd.verify(hash, signature), 'verified')
      }))
    })
  })

  describe('fromBase58 / toBase58', function () {
    validAll.forEach(function (f) {
      it(`exports ${f.base58} (public) correctly`, function () {
        const hd = HDNode.fromBase58(f.base58, NETWORKS_LIST)

        assert.strictEqual(hd.base58, f.base58)
        assert.throws(function () { hd.keyPair.toWIF() }, /Missing private key/)
      })
    })

    validAll.forEach(function (f) {
      it(`exports ${f.base58Priv} (private) correctly`, function () {
        const hd = HDNode.fromBase58(f.base58Priv, NETWORKS_LIST)

        assert.strictEqual(hd.base58, f.base58Priv)
        assert.strictEqual(hd.keyPair.toWIF(), f.wif)
      })
    })

    fixtures.invalid.fromBase58.forEach(function (f) {
      it(`throws on ${f.string}`, function () {
        assert.throws(function () {
          const networks = f.network ? NETWORKS[f.network] : NETWORKS_LIST

          HDNode.fromBase58(f.string, networks)
        }, new RegExp(f.exception))
      })
    })
  })

  describe('getIdentifier', function () {
    validAll.forEach(function (f) {
      it(`returns the identifier for ${f.fingerprint}`, function () {
        const hd = HDNode.fromBase58(f.base58, NETWORKS_LIST)

        assert.strictEqual(hd.identifier.toString('hex'), f.identifier)
      })
    })
  })

  describe('fingerprint', function () {
    validAll.forEach(function (f) {
      it(`returns the fingerprint for ${f.fingerprint}`, function () {
        const hd = HDNode.fromBase58(f.base58, NETWORKS_LIST)

        assert.strictEqual(hd.fingerprint.toString('hex'), f.fingerprint)
      })
    })
  })

  describe('neutered / isNeutered', function () {
    validAll.forEach(function (f) {
      it(`drops the private key for ${f.fingerprint}`, function () {
        const hd = HDNode.fromBase58(f.base58Priv, NETWORKS_LIST)
        const hdn = hd.neutered

        assert.notEqual(hdn.keyPair, hd.keyPair)
        assert.throws(function () { hdn.keyPair.toWIF() }, /Missing private key/)
        assert.strictEqual(hdn.base58, f.base58)
        assert.strictEqual(hdn.chainCode, hd.chainCode)
        assert.strictEqual(hdn.depth, f.depth >>> 0)
        assert.strictEqual(hdn.index, f.index >>> 0)
        assert.strictEqual(hdn.isNeutered, true)

        // does not modify the original
        assert.strictEqual(hd.base58, f.base58Priv)
        assert.strictEqual(hd.isNeutered, false)
      })
    })
  })

  describe('derive', function () {
    function verifyVector (hd, v) {
      if (hd.isNeutered) {
        assert.strictEqual(hd.base5, v.base58)
      } else {
        assert.strictEqual(hd.neutered.base58, v.base58)
        assert.strictEqual(hd.base58, v.base58Priv)
      }

      assert.strictEqual(hd.fingerprint.toString('hex'), v.fingerprint)
      assert.strictEqual(hd.identifier.toString('hex'), v.identifier)
      assert.strictEqual(hd.address, v.address)
      assert.strictEqual(hd.keyPair.toWIF(), v.wif)
      assert.strictEqual(hd.keyPair.getPublicKeyBuffer().toString('hex'), v.pubKey)
      assert.strictEqual(hd.chainCode.toString('hex'), v.chainCode)
      assert.strictEqual(hd.depth, v.depth >>> 0)
      assert.strictEqual(hd.index, v.index >>> 0)
    }

    fixtures.valid.forEach(function (f) {
      const network = NETWORKS[f.network]
      let hd = HDNode.fromSeedHex(f.master.seed, network)
      const master = hd

      // testing deriving path from master
      f.children.forEach(function (c) {
        it(`${c.path} from ${f.master.fingerprint} by path`, function () {
          const child = master.derivePath(c.path)
          const childNoM = master.derivePath(c.path.slice(2)) // no m/ on path

          verifyVector(child, c)
          verifyVector(childNoM, c)
        })
      })

      // testing deriving path from children
      f.children.forEach(function (c, i) {
        const cn = master.derivePath(c.path)

        f.children.slice(i + 1).forEach(function (cc) {
          it(`${cc.path} from ${c.fingerprint} by path`, function () {
            const ipath = cc.path.slice(2).split('/').slice(i + 1).join('/')
            const child = cn.derivePath(ipath)
            verifyVector(child, cc)

            assert.throws(function () {
              cn.derivePath(`m/${ipath}`)
            }, /Not a master node/)
          })
        })
      })

      // FIXME: test data is only testing Private -> private for now
      f.children.forEach(function (c) {
        if (c.m === undefined) return

        it(`${c.path} from ${f.master.fingerprint}`, function () {
          if (c.hardened) {
            hd = hd.deriveHardened(c.m)
          } else {
            hd = hd.derive(c.m)
          }

          verifyVector(hd, c)
        })
      })
    })

    it('works for Private -> public (neutered)', function () {
      const f = fixtures.valid[1]
      const c = f.children[0]

      const master = HDNode.fromBase58(f.master.base58Priv, NETWORKS_LIST)
      const child = master.derive(c.m).neutered

      assert.strictEqual(child.base58, c.base58)
    })

    it('works for Private -> public (neutered, hardened)', function () {
      const f = fixtures.valid[0]
      const c = f.children[0]

      const master = HDNode.fromBase58(f.master.base58Priv, NETWORKS_LIST)
      const child = master.deriveHardened(c.m).neutered

      assert.strictEqual(c.base58, child.base58)
    })

    it('works for Public -> public', function () {
      const f = fixtures.valid[1]
      const c = f.children[0]

      const master = HDNode.fromBase58(f.master.base58, NETWORKS_LIST)
      const child = master.derive(c.m)

      assert.strictEqual(c.base58, child.base58)
    })

    it('throws on Public -> public (hardened)', function () {
      const f = fixtures.valid[0]
      const c = f.children[0]

      const master = HDNode.fromBase58(f.master.base58, NETWORKS_LIST)

      assert.throws(function () {
        master.deriveHardened(c.m)
      }, /Could not derive hardened child key/)
    })

    it('throws on wrong types', function () {
      const f = fixtures.valid[0]
      const master = HDNode.fromBase58(f.master.base58, NETWORKS_LIST)

      fixtures.invalid.derive.forEach(function (fx) {
        assert.throws(function () {
          master.derive(fx)
        }, /Expected UInt32/)
      })

      fixtures.invalid.deriveHardened.forEach(function (fx) {
        assert.throws(function () {
          master.deriveHardened(fx)
        }, /Expected UInt31/)
      })

      fixtures.invalid.derivePath.forEach(function (fx) {
        assert.throws(function () {
          master.derivePath(fx)
        }, /Expected BIP32 derivation path/)
      })
    })

    it('works when private key has leading zeros', function () {
      const key = 'xprv9s21ZrQH143K3ckY9DgU79uMTJkQRLdbCCVDh81SnxTgPzLLGax6uHeBULTtaEtcAvKjXfT7ZWtHzKjTpujMkUd9dDb8msDeAfnJxrgAYhr'
      const hdkey = HDNode.fromBase58(key, NETWORKS.bitcoin)
      assert.strictEqual(hdkey.keyPair.d.toBuffer(32).toString('hex'), '00000055378cf5fafb56c711c674143f9b0ee82ab0ba2924f19b64f5ae7cdbfd')
      const child = hdkey.derivePath('m/44\'/0\'/0\'/0/0\'')
      assert.strictEqual(child.keyPair.d.toBuffer().toString('hex'), '3348069561d2a0fb925e74bf198762acc47dce7db27372257d2d959a9e6f8aeb')
    })
  })
})
