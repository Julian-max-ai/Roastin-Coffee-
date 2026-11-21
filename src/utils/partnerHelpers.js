'use strict';
function getReps(partner) {
  if (!partner) return [];
  if (Array.isArray(partner.representativeIds) && partner.representativeIds.length) return partner.representativeIds;
  if (partner.representativeId) return [partner.representativeId];
  return [];
}
module.exports = { getReps };
