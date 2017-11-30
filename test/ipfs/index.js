/* eslint-disable max-len */

require("should");
const Buffer = require("buffer/").Buffer;
const ark = require("../../index.js");

describe("ipfs.js", function () {

  const ipfs = ark.ipfs;

  it("should be ok", function () {
    (ipfs).should.be.ok;
  });

  it("should be object", function () {
    (ipfs).should.be.type("object");
  });

  it("should have createHashRegistration property", function () {
    (ipfs).should.have.property("createHashRegistration");
  });

  it("should create transaction with hashid & deserialise correctly", function () {
    const trs = ipfs.createHashRegistration("QmW2WQi7j6c7UgJTarActp7tDNikE4B2qXtFCfLPdsgaTQ/cat.jpg", "secret");
    (trs).should.be.ok;

    const deserialisedTx = ark.crypto.fromBytes(ark.crypto.getBytes(trs).toString("hex"));
    const keys = Object.keys(deserialisedTx)
    for (const key of keys) {
      deserialisedTx[key].should.equal(trs[key]);
    }
  });

  describe("returned transaction", function () {
    let trs

    before(function () {
      trs = ipfs.createHashRegistration("QmW2WQi7j6c7UgJTarActp7tDNikE4B2qXtFCfLPdsgaTQ/cat.jpg", "secret");
      (trs).should.be.ok;
    });

    it("should be object", function () {
      (trs).should.be.type("object");
    });

    it("should have id as string", function () {
      (trs.id).should.be.type("string");
    });

    it("should have vendorField as string", function () {
      (trs.vendorFieldHex).should.be.type("string");
    });

    it("should have vendorFieldHex equal to '00000000000000000000516d5732575169376a36633755674a546172416374703774444e696b453442327158744643664c506473676154512f6361742e6a7067'", function () {
      (trs.vendorFieldHex).should.be.type("string").and.equal('00000000000000000000516d5732575169376a36633755674a546172416374703774444e696b453442327158744643664c506473676154512f6361742e6a7067');
    });

    it("should have type as number and equal 5", function () {
      (trs.type).should.be.type("number").and.equal(5);
    });

    it("should have timestamp as number", function () {
      (trs.timestamp).should.be.type("number").and.not.NaN;
    });

    it("should have senderPublicKey as hex string", function () {
      (trs.senderPublicKey).should.be.type("string").and.match(() => {
        try {
          new Buffer(trs.senderPublicKey, "hex")
        } catch (e) {
          return false;
        }

        return true;
      })
    });

    it("should have amount as number and equal to 0", function () {
      (trs.amount).should.be.type("number").and.equal(0);
    });

    it("should have empty asset object", function () {
      (trs.asset).should.be.type("object").and.empty;
    });

    it("should does not have second signature", function () {
      (trs).should.not.have.property("signSignature");
    });

    it("should have signature as hex string", function () {
      (trs.signature).should.be.type("string").and.match(() => {
        try {
          new Buffer(trs.signature, "hex")
        } catch (e) {
          return false;
        }

        return true;
      })
    });

    it("should be signed correctly", function () {
      const result = ark.crypto.verify(trs);
      (result).should.be.ok;
    });

    it("should not be signed correctly now (changed amount)", function () {
      trs.amount = 10000;
      const result = ark.crypto.verify(trs);
      (result).should.be.not.ok;
    });

    it("should not be signed correctly now (changed vendorField)", function () {
      trs.vendorField = "bouloup";
      const result = ark.crypto.verify(trs);
      (result).should.be.not.ok;
    });
  });

});
