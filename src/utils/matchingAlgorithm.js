class MatchingAlgorithm {
  constructor() {
    this.skillsDatabase = {
      javascript: 1,
      python: 2,
      java: 3,
      react: 4,
      "node.js": 5,
      angular: 6,
      vue: 7,
      typescript: 8,
      php: 9,
      "c++": 10,
      "c#": 11,
      ruby: 12,
      go: 13,
      rust: 14,
      swift: 15,
      kotlin: 16,
      flutter: 17,
      "react native": 18,
      mongodb: 19,
      mysql: 20,
      postgresql: 21,
      redis: 22,
      docker: 23,
      kubernetes: 24,
      aws: 25,
      azure: 26,
      gcp: 27,
      "machine learning": 28,
      ai: 29,
      "data science": 30,
      blockchain: 31,
      cybersecurity: 32,
      devops: 33,
      frontend: 34,
      backend: 35,
      fullstack: 36,
      "mobile development": 37,
      "web development": 38,
      "game development": 39,
      "ui/ux": 40,
      design: 41,
      testing: 42,
      automation: 43,
    };
  }

  skillsToVector(skills) {
    const vector = new Array(Object.keys(this.skillsDatabase).length).fill(0);
    if (!skills || !Array.isArray(skills)) return vector;

    skills.forEach((skill) => {
      const normalizedSkill = skill.toLowerCase().trim();
      const index = this.skillsDatabase[normalizedSkill];
      if (index !== undefined) {
        vector[index - 1] = 1;
      }
    });
    return vector;
  }

  cosineSimilarity(vectorA, vectorB) {
    if (vectorA.length !== vectorB.length) return 0;

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < vectorA.length; i++) {
      dotProduct += vectorA[i] * vectorB[i];
      magnitudeA += vectorA[i] * vectorA[i];
      magnitudeB += vectorB[i] * vectorB[i];
    }

    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    if (magnitudeA === 0 || magnitudeB === 0) return 0;
    return dotProduct / (magnitudeA * magnitudeB);
  }

  ageSimilarity(age1, age2) {
    if (!age1 || !age2) return 0;
    const ageDiff = Math.abs(age1 - age2);
    const maxAgeDiff = 20;
    return Math.max(0, 1 - ageDiff / maxAgeDiff);
  }

  calculateMatchPercentage(user1, user2) {
    const user1SkillsVector = this.skillsToVector(user1.skills);
    const user2SkillsVector = this.skillsToVector(user2.skills);
    const skillsSimilarity = this.cosineSimilarity(
      user1SkillsVector,
      user2SkillsVector
    );
    const ageSimil = this.ageSimilarity(user1.age, user2.age);
    const overallSimilarity = skillsSimilarity * 0.8 + ageSimil * 0.2;
    const percentage = Math.round(overallSimilarity * 100);

    return {
      overall: percentage,
      skills: Math.round(skillsSimilarity * 100),
      age: Math.round(ageSimil * 100),
      breakdown: {
        skillsWeight: 80,
        ageWeight: 20,
        commonSkills: this.getCommonSkills(user1.skills, user2.skills),
      },
    };
  }

  getCommonSkills(skills1, skills2) {
    if (!skills1 || !skills2) return [];
    const normalizedSkills1 = skills1.map((s) => s.toLowerCase().trim());
    const normalizedSkills2 = skills2.map((s) => s.toLowerCase().trim());
    return normalizedSkills1.filter((skill) =>
      normalizedSkills2.includes(skill)
    );
  }

  rankUsersByMatch(currentUser, users, minThreshold = 0) {
    const rankedUsers = users
      .filter((user) => user._id.toString() !== currentUser._id.toString())
      .map((user) => {
        const matchData = this.calculateMatchPercentage(currentUser, user);
        return {
          ...(user.toObject ? user.toObject() : user),
          matchPercentage: matchData.overall,
          matchBreakdown: matchData,
        };
      })
      .filter((user) => user.matchPercentage >= minThreshold)
      .sort((a, b) => b.matchPercentage - a.matchPercentage);

    return rankedUsers;
  }
}

module.exports = new MatchingAlgorithm();
