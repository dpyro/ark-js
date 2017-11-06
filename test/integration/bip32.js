/* global describe, it */

const assert = require('assert')
const bigi = require('bigi')
const ark = require('../../')
const crypto = require('crypto')

const ecurve = require('ecurve')
const secp256k1 = ecurve.getCurveByName('secp256k1')

describe('ark-js (BIP32)', function () {
  it('can create a BIP32 wallet external address', function () {
    const path = "m/0'/0/0"
    const root = ark.HDNode.fromSeedHex('dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd')

    const child1 = root.derivePath(path)

    // option 2, manually
    const child2 = root.deriveHardened(0)
      .derive(0)
      .derive(0)

    assert.equal(child1.address, 'AZXdSTRFGHPokX6yfXTfHcTzzHKncioj31')
    assert.equal(child2.address, 'AZXdSTRFGHPokX6yfXTfHcTzzHKncioj31')
  })

  it('can create a BIP44, ark, account 0, external address', function () {
    const path = "m/44'/0'/0'/0/0"
    const root = ark.HDNode.fromSeedHex('dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd')

    const child1 = root.derivePath(path)

    // option 2, manually
    const child2 = root.deriveHardened(44)
      .deriveHardened(0)
      .deriveHardened(0)
      .derive(0)
      .derive(0)

    assert.equal(child1.address, 'AVbXc2KyxtXeAP9zQpp7ixsnaxEEQ6wZbq')
    assert.equal(child2.address, 'AVbXc2KyxtXeAP9zQpp7ixsnaxEEQ6wZbq')
  })

  it('can recover a BIP32 parent private key from the parent public key, and a derived, non-hardened child private key', function () {
    function recoverParent (master, child) {
      assert(!master.keyPair.d, 'You already have the parent private key')
      assert(child.keyPair.d, 'Missing child private key')

      const curve = secp256k1
      const QP = master.keyPair.Q
      const serQP = master.keyPair.getPublicKeyBuffer()

      const d1 = child.keyPair.d
      let d2
      const data = new Buffer(37)
      serQP.copy(data, 0)

      // search index space until we find it
      for (let i = 0; i < ark.HDNode.HIGHEST_BIT; ++i) {
        data.writeUInt32BE(i, 33)

        // calculate I
        const I = crypto.createHmac('sha512', master.chainCode).update(data).digest()
        const IL = I.slice(0, 32)
        const pIL = bigi.fromBuffer(IL)

        // See hdnode.js:273 to understand
        d2 = d1.subtract(pIL).mod(curve.n)

        const Qp = new ark.ECPair(d2).Q
        if (Qp.equals(QP)) break
      }

      const node = new ark.HDNode(new ark.ECPair(d2), master.chainCode, master.network)
      node.depth = master.depth
      node.index = master.index
      node.masterFingerprint = master.masterFingerprint
      return node
    }

    const seed = crypto.randomBytes(32)
    const master = ark.HDNode.fromSeedBuffer(seed)
    const child = master.derive(6) // m/6

    // now for the recovery
    const neuteredMaster = master.neutered
    const recovered = recoverParent(neuteredMaster, child)
    assert.strictEqual(recovered.toBase58(), master.toBase58())
  })
})
