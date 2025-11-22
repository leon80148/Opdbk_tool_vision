import { useState } from 'react';
import { Input, Button } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import './SearchBar.css';

function SearchBar({ onSearch, loading }) {
  const [patientId, setPatientId] = useState('');

  const handleSearch = () => {
    if (patientId.trim()) {
      onSearch(patientId.trim());
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="search-bar">
      <Input
        size="large"
        placeholder="請輸入病歷號或身分證字號"
        value={patientId}
        onChange={(e) => setPatientId(e.target.value)}
        onKeyPress={handleKeyPress}
        prefix={<SearchOutlined />}
        autoFocus
        disabled={loading}
        className="search-input"
      />
      <Button
        type="primary"
        size="large"
        onClick={handleSearch}
        loading={loading}
        className="search-button"
      >
        查詢
      </Button>
    </div>
  );
}

export default SearchBar;
