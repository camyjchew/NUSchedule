import React, { useEffect, useMemo, useState } from 'react';
import OverlayGrid from './OverlayGrid';
import computeOverlay from '../utils/computeOverlay';
import './GroupView.css';

export default function GroupView({ groupId, nusmodsData }) {
  const [groupData, setGroupData] = useState(null);
  const [activeMembers, setActiveMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGroup = async () => {
      try {
        const response = await fetch(`/group/${groupId}`);
        const data = await response.json();
        setGroupData(data);
        setActiveMembers(data.members.map((member) => member.userId));
      } catch (error) {
        console.error('Error fetching group:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchGroup();
  }, [groupId]);

  const overlaySlots = useMemo(() => {
    if (!groupData) {
      return [];
    }

    return computeOverlay(groupData.members, activeMembers, nusmodsData);
  }, [groupData, activeMembers, nusmodsData]);

  const toggleMember = (userId) => {
    setActiveMembers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  if (loading) {
    return <div className="group-view-container">Loading group data...</div>;
  }

  if (!groupData) {
    return <div className="group-view-container">Group not found</div>;
  }

  return (
    <div className="group-view-container">
      <div className="group-view-header">
        <div>
          <h2>{groupData.name}</h2>
          <p>Colour-coded availability overlay for the active members.</p>
        </div>
        <div className="member-count">
          Showing {activeMembers.length} of {groupData.members.length} members
        </div>
      </div>

      <div className="group-controls">
        <div className="member-toggles">
          {groupData.members.map((member) => (
            <button
              key={member.userId}
              type="button"
              className={`member-toggle ${activeMembers.includes(member.userId) ? 'active' : ''}`}
              onClick={() => toggleMember(member.userId)}
            >
              {member.name}
            </button>
          ))}
        </div>
      </div>

      <OverlayGrid overlaySlots={overlaySlots} />
    </div>
  );
}
